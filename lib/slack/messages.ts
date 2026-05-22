// Block Kit payload builders. Slack rejects unknown block shapes at send-time,
// so we keep the inner shapes loosely typed (unknown[]) rather than mirror
// Slack's full type tree here.

export interface CriticalBugMessage {
  bugId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH';
  projectName: string | null;
  origin: string;
}

export interface ReadinessFlipMessage {
  projectId: string;
  projectName: string;
  previousVerdict: 'GO' | 'CAUTION' | 'NO_GO';
  newVerdict: 'GO' | 'CAUTION' | 'NO_GO';
  score: number;
  blockerCount: number;
  origin: string;
}

export interface DigestMessage {
  origin: string;
  openCriticalCount: number;
  currentVerdict: 'GO' | 'CAUTION' | 'NO_GO' | 'UNKNOWN';
  newBugsLast24h: number;
}

export function criticalBugBlocks(d: CriticalBugMessage): unknown[] {
  const emoji = d.severity === 'CRITICAL' ? ':red_circle:' : ':large_orange_circle:';
  const fields: unknown[] = [{ type: 'mrkdwn', text: `*Severity*\n${d.severity}` }];
  if (d.projectName) fields.unshift({ type: 'mrkdwn', text: `*Project*\n${escapeMrkdwn(d.projectName)}` });
  return [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} ${d.severity} bug created` } },
    { type: 'section', fields },
    { type: 'section', text: { type: 'mrkdwn', text: `*${escapeMrkdwn(d.title)}*` } },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in BugSense' },
          url: `${d.origin}/bugs?bug=${encodeURIComponent(d.bugId)}`,
        },
      ],
    },
  ];
}

export function readinessFlipBlocks(d: ReadinessFlipMessage): unknown[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `:warning: Release readiness: ${d.previousVerdict} → ${d.newVerdict}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Project*\n${escapeMrkdwn(d.projectName)}` },
        { type: 'mrkdwn', text: `*Score*\n${d.score}/100` },
        { type: 'mrkdwn', text: `*Blockers*\n${d.blockerCount}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View readiness' },
          style: 'danger',
          url: `${d.origin}/readiness?projectId=${encodeURIComponent(d.projectId)}`,
        },
      ],
    },
  ];
}

export function dailyDigestBlocks(d: DigestMessage): unknown[] {
  return [
    { type: 'header', text: { type: 'plain_text', text: ':bar_chart: BugSense daily digest' } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Open critical*\n${d.openCriticalCount}` },
        { type: 'mrkdwn', text: `*Readiness*\n${d.currentVerdict}` },
        { type: 'mrkdwn', text: `*New bugs (24h)*\n${d.newBugsLast24h}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open dashboard' },
          url: `${d.origin}/dashboard`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Daily digest is sent at 08:00 UTC. Per-workspace timezone is on the roadmap.',
        },
      ],
    },
  ];
}

export function testMessageBlocks(teamName: string): unknown[] {
  return [
    { type: 'header', text: { type: 'plain_text', text: ':wave: BugSense ↔ Slack' } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hello *${escapeMrkdwn(teamName)}* — notifications are wired up correctly.`,
      },
    },
  ];
}

function escapeMrkdwn(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}
