import { and, eq } from 'drizzle-orm';
import { decryptToken } from '@/lib/crypto/tokens';
import { db } from '@/lib/database/db';
import { integrations, projects } from '@/lib/database/schema';
import { parseSlackConfig, type SlackNotificationsConfig } from '@/types/slack';
import { postMessage } from './client';
import {
  criticalBugBlocks,
  dailyDigestBlocks,
  readinessFlipBlocks,
  testMessageBlocks,
  type DigestMessage,
} from './messages';

type EventKey = keyof SlackNotificationsConfig;

interface ResolvedTarget {
  channelId: string;
  accessToken: string;
  teamName: string;
}

async function resolveTarget(organizationId: string, eventKey: EventKey): Promise<ResolvedTarget | null> {
  if (!db) return null;
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.organizationId, organizationId), eq(integrations.type, 'SLACK')),
  });
  if (!integration || !integration.isActive) return null;
  const cfg = parseSlackConfig(integration.config);
  if (!cfg || !cfg.tokens?.accessTokenEnc) return null;
  if (!cfg.notifications[eventKey]) return null;
  try {
    return {
      channelId: cfg.channel_id,
      accessToken: decryptToken(cfg.tokens.accessTokenEnc),
      teamName: cfg.team_name,
    };
  } catch (err) {
    console.warn('[slack/dispatcher] decrypt failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function safePost(target: ResolvedTarget, blocks: unknown[], fallback: string): Promise<boolean> {
  if (process.env.SLACK_DRY_RUN === '1') {
    console.log(
      '[slack/dispatcher] SLACK_DRY_RUN payload:',
      JSON.stringify({ channel: target.channelId, fallback, blocks }),
    );
    return true;
  }
  try {
    await postMessage({ accessToken: target.accessToken, channel: target.channelId, blocks, text: fallback });
    return true;
  } catch (err) {
    console.warn('[slack/dispatcher] postMessage failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export interface CriticalBugInput {
  projectId: string | null;
  bugId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH';
  origin: string;
}

export async function tryNotifyCriticalBug(input: CriticalBugInput): Promise<boolean> {
  if (!db || !input.projectId) return false;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: { name: true, organizationId: true },
  });
  if (!project?.organizationId) return false;
  const target = await resolveTarget(project.organizationId, 'critical_bug');
  if (!target) return false;
  const blocks = criticalBugBlocks({
    bugId: input.bugId,
    title: input.title,
    severity: input.severity,
    projectName: project.name,
    origin: input.origin,
  });
  return safePost(target, blocks, `${input.severity} bug: ${input.title}`);
}

export interface ReadinessFlipInput {
  organizationId: string;
  projectId: string;
  projectName: string;
  previousVerdict: 'GO' | 'CAUTION' | 'NO_GO';
  newVerdict: 'GO' | 'CAUTION' | 'NO_GO';
  score: number;
  blockerCount: number;
  origin: string;
}

export async function tryNotifyReadinessFlip(input: ReadinessFlipInput): Promise<boolean> {
  const target = await resolveTarget(input.organizationId, 'readiness_flip');
  if (!target) return false;
  const blocks = readinessFlipBlocks(input);
  return safePost(
    target,
    blocks,
    `Release readiness: ${input.previousVerdict} → ${input.newVerdict} for ${input.projectName}`,
  );
}

export async function tryNotifyDailyDigest(organizationId: string, digest: DigestMessage): Promise<boolean> {
  const target = await resolveTarget(organizationId, 'daily_digest');
  if (!target) return false;
  const blocks = dailyDigestBlocks(digest);
  return safePost(
    target,
    blocks,
    `Daily digest: ${digest.openCriticalCount} open critical, readiness ${digest.currentVerdict}`,
  );
}

export interface TestMessageResult {
  ok: boolean;
  reason?: string;
}

export async function sendTestMessage(organizationId: string): Promise<TestMessageResult> {
  if (!db) return { ok: false, reason: 'no_db' };
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.organizationId, organizationId), eq(integrations.type, 'SLACK')),
  });
  if (!integration || !integration.isActive) return { ok: false, reason: 'not_connected' };
  const cfg = parseSlackConfig(integration.config);
  if (!cfg || !cfg.tokens?.accessTokenEnc) return { ok: false, reason: 'no_token' };

  let accessToken: string;
  try {
    accessToken = decryptToken(cfg.tokens.accessTokenEnc);
  } catch {
    return { ok: false, reason: 'decrypt_failed' };
  }

  if (process.env.SLACK_DRY_RUN === '1') {
    console.log('[slack/dispatcher] SLACK_DRY_RUN test message to', cfg.channel_id);
    return { ok: true };
  }

  try {
    await postMessage({
      accessToken,
      channel: cfg.channel_id,
      blocks: testMessageBlocks(cfg.team_name),
      text: 'BugSense ↔ Slack test message',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'send_failed' };
  }
}
