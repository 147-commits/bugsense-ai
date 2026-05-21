import type {
  Blocker,
  ReadinessInput,
  ReadinessResult,
  SeverityCounts,
  SignalBreakdown,
  Verdict,
} from '@/types/readiness';

// ── Config ────────────────────────────────────────────────────────────────────
//
// All tuning knobs live here so behaviour is configurable without touching the
// function body. Tests may pass a widened ReadinessConfig to pin a scenario
// without mutating module state.

export const READINESS_CONFIG = {
  weights: { bugs: 0.5, tests: 0.3, quality: 0.2 },
  thresholds: { go: 85, caution: 60 },
  hardBlockers: {
    criticalBugForcesNoGo: true,
    maxScoreOnHardBlock: 59,
  },
  severityPenalties: { critical: 25, high: 10, medium: 3, low: 0.5, info: 0 },
  neutralDefaults: { testPassRate: 80, qualityScore: 75 },
} as const;

export type ReadinessConfig = {
  weights: { bugs: number; tests: number; quality: number };
  thresholds: { go: number; caution: number };
  hardBlockers: {
    criticalBugForcesNoGo: boolean;
    maxScoreOnHardBlock: number;
  };
  severityPenalties: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  neutralDefaults: {
    testPassRate: number;
    qualityScore: number;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function bugsSubscore(counts: SeverityCounts, penalties: ReadinessConfig['severityPenalties']): number {
  const penalty =
    counts.critical * penalties.critical +
    counts.high * penalties.high +
    counts.medium * penalties.medium +
    counts.low * penalties.low +
    counts.info * penalties.info;
  return clamp(100 - penalty, 0, 100);
}

function verdictFor(score: number, thresholds: ReadinessConfig['thresholds']): Verdict {
  if (score >= thresholds.go) return 'GO';
  if (score >= thresholds.caution) return 'CAUTION';
  return 'NO_GO';
}

// ── Pure scoring function ─────────────────────────────────────────────────────

export function computeReadinessScore(
  input: ReadinessInput,
  config: ReadinessConfig = READINESS_CONFIG,
): ReadinessResult {
  const { weights, thresholds, hardBlockers, severityPenalties, neutralDefaults } = config;

  const bugsRaw = bugsSubscore(input.openBugs, severityPenalties);
  const testsRaw = input.testPassRate ?? neutralDefaults.testPassRate;
  const qualityRaw = input.avgQualityScore ?? neutralDefaults.qualityScore;

  const weightedSum =
    bugsRaw * weights.bugs + testsRaw * weights.tests + qualityRaw * weights.quality;

  const blockers: Blocker[] = input.criticalBugDetails.map((b) => ({
    id: b.id,
    title: b.title,
    type: 'critical_bug',
  }));

  const hardBlocked = hardBlockers.criticalBugForcesNoGo && blockers.length > 0;
  const capped = hardBlocked ? Math.min(weightedSum, hardBlockers.maxScoreOnHardBlock) : weightedSum;
  const score = Math.round(clamp(capped, 0, 100));

  const breakdown: SignalBreakdown[] = [
    {
      key: 'bugs',
      label: 'Open bugs',
      weight: weights.bugs,
      raw: Math.round(bugsRaw),
      weightedContribution: Math.round(bugsRaw * weights.bugs),
      maxContribution: Math.round(weights.bugs * 100),
    },
    {
      key: 'tests',
      label: 'Test pass rate',
      weight: weights.tests,
      raw: Math.round(testsRaw),
      weightedContribution: Math.round(testsRaw * weights.tests),
      maxContribution: Math.round(weights.tests * 100),
      note: input.testPassRate === null ? 'No test run data yet — using neutral default' : undefined,
    },
    {
      key: 'quality',
      label: 'AI quality score',
      weight: weights.quality,
      raw: Math.round(qualityRaw),
      weightedContribution: Math.round(qualityRaw * weights.quality),
      maxContribution: Math.round(weights.quality * 100),
      note:
        input.avgQualityScore === null
          ? 'No scored reports yet — using neutral default'
          : undefined,
    },
  ];

  return { score, verdict: verdictFor(score, thresholds), breakdown, blockers };
}
