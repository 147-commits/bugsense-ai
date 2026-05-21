import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import {
  bugJiraLinks,
  bugReports,
  integrations,
  type BugReport,
  type Integration,
} from '@/lib/database/schema';
import { parseJiraConfig, type JiraConfig } from '@/types/jira';
import {
  addRemoteLink,
  createIssue,
  JiraError,
  listTransitions,
  transitionIssue,
  updateIssue,
  type JiraClient,
} from './client';
import { markdownToAdf } from './adf';

export class SyncNotConfiguredError extends Error {}
export class SyncDryRunError extends Error {}

export interface SyncResult {
  jiraIssueKey: string;
  jiraIssueId: string;
  created: boolean;
  transitioned: boolean;
  skipped: boolean;
  reason?: string;
}

export interface PushOptions {
  /** Origin used to build remote-link URLs back into BugSense. */
  siteOrigin?: string;
}

/**
 * Push a single bug to Jira. Creates an issue the first time; updates
 * it on subsequent calls. Idempotent via a hash of the synced fields:
 * if nothing has changed since the last successful push, this is a
 * no-op.
 */
export async function pushBugToJira(bugId: string, opts: PushOptions = {}): Promise<SyncResult> {
  if (!db) throw new SyncNotConfiguredError('Database is not configured.');

  const bug = await db.query.bugReports.findFirst({
    where: eq(bugReports.id, bugId),
    with: { project: true, jiraLink: true },
  });
  if (!bug) throw new SyncNotConfiguredError('Bug not found.');
  if (!bug.project?.organizationId) {
    throw new SyncNotConfiguredError('Bug is not in an organization.');
  }

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, bug.project.organizationId),
      eq(integrations.type, 'JIRA'),
    ),
  });
  if (!integration || !integration.isActive) {
    throw new SyncNotConfiguredError('No active Jira integration for this organization.');
  }
  const config = parseJiraConfig(integration.config);
  if (!config) throw new SyncNotConfiguredError('Jira integration config is invalid.');
  if (!config.mappings.projectKey) {
    throw new SyncNotConfiguredError('Jira project key is not set — configure mappings first.');
  }

  const hash = computeBugHash(bug);
  const link = bug.jiraLink;
  if (link && link.lastOutboundHash === hash) {
    return {
      jiraIssueKey: link.jiraIssueKey,
      jiraIssueId: link.jiraIssueId,
      created: false,
      transitioned: false,
      skipped: true,
      reason: 'no changes since last sync',
    };
  }

  if (process.env.JIRA_DRY_RUN === '1') {
    throw new SyncDryRunError(
      `JIRA_DRY_RUN=1 — would ${link ? 'update' : 'create'} ${config.mappings.projectKey} issue for bug ${bug.id}`,
    );
  }

  const client = makeClient(integration, config);
  const priorityName = config.mappings.priority[bug.severity];
  const statusName = config.mappings.status[bug.status];

  let issueKey: string;
  let issueId: string;
  let created = false;

  if (!link) {
    const issue = await createIssue(client, {
      fields: {
        project: { key: config.mappings.projectKey },
        summary: truncate(bug.title, 250),
        description: markdownToAdf(buildDescription(bug)),
        issuetype: { name: config.mappings.issueTypeName },
        ...(priorityName ? { priority: { name: priorityName } } : {}),
      },
    });
    issueKey = issue.key;
    issueId = issue.id;
    created = true;

    if (opts.siteOrigin) {
      try {
        await addRemoteLink(
          client,
          issueKey,
          `${opts.siteOrigin}/bugs?bug=${encodeURIComponent(bug.id)}`,
          `BugSense: ${truncate(bug.title, 200)}`,
        );
      } catch (err) {
        console.warn('[jira/sync] remote link failed:', err instanceof Error ? err.message : err);
      }
    }
  } else {
    issueKey = link.jiraIssueKey;
    issueId = link.jiraIssueId;
    await updateIssue(client, issueKey, {
      fields: {
        summary: truncate(bug.title, 250),
        description: markdownToAdf(buildDescription(bug)),
        ...(priorityName ? { priority: { name: priorityName } } : {}),
      },
    });
  }

  let transitioned = false;
  if (statusName) {
    try {
      const transitions = await listTransitions(client, issueKey);
      const target = transitions.find(
        (t) =>
          t.to.name.toLowerCase() === statusName.toLowerCase() ||
          t.name.toLowerCase() === statusName.toLowerCase(),
      );
      if (target) {
        await transitionIssue(client, issueKey, target.id);
        transitioned = true;
      }
    } catch (err) {
      console.warn('[jira/sync] transition failed:', err instanceof Error ? err.message : err);
    }
  }

  if (!link) {
    await db.insert(bugJiraLinks).values({
      bugReportId: bug.id,
      integrationId: integration.id,
      jiraIssueKey: issueKey,
      jiraIssueId: issueId,
      jiraCloudId: config.cloudId,
      lastOutboundHash: hash,
      lastOutboundAt: new Date(),
    });
  } else {
    await db
      .update(bugJiraLinks)
      .set({ lastOutboundHash: hash, lastOutboundAt: new Date() })
      .where(eq(bugJiraLinks.id, link.id));
  }

  return { jiraIssueKey: issueKey, jiraIssueId: issueId, created, transitioned, skipped: false };
}

/**
 * Fire-and-forget variant for the analyze pipeline. Swallows all errors
 * so it never blocks the user response. Returns null when sync isn't
 * applicable (no integration, missing config, etc.) or fails.
 */
export async function tryPushBugToJira(bugId: string, opts: PushOptions = {}): Promise<SyncResult | null> {
  try {
    return await pushBugToJira(bugId, opts);
  } catch (err) {
    if (err instanceof SyncNotConfiguredError || err instanceof SyncDryRunError) {
      return null;
    }
    if (err instanceof JiraError) {
      console.warn('[jira/sync] Jira error on auto-push:', err.message);
    } else {
      console.warn('[jira/sync] auto-push failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

function buildDescription(bug: BugReport): string {
  const parts: string[] = [];
  if (bug.description) parts.push(bug.description);
  if (bug.stepsToReproduce.length > 0) {
    parts.push('**Steps to reproduce:**');
    parts.push(bug.stepsToReproduce.map((s) => `- ${s}`).join('\n'));
  }
  if (bug.expectedResult) parts.push(`**Expected:** ${bug.expectedResult}`);
  if (bug.actualResult) parts.push(`**Actual:** ${bug.actualResult}`);
  return parts.join('\n\n');
}

function computeBugHash(bug: BugReport): string {
  const payload = JSON.stringify({
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    status: bug.status,
    steps: bug.stepsToReproduce,
    expected: bug.expectedResult,
    actual: bug.actualResult,
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function makeClient(integration: Integration, config: JiraConfig): JiraClient {
  return {
    cloudId: config.cloudId,
    siteUrl: config.siteUrl,
    config,
    persist: async (next) => {
      if (!db) return;
      await db
        .update(integrations)
        .set({ config: next, updatedAt: new Date() })
        .where(eq(integrations.id, integration.id));
    },
  };
}
