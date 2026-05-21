export type Verdict = 'GO' | 'CAUTION' | 'NO_GO';

export type SeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

export type Blocker = {
  id: string;
  title: string;
  type: 'critical_bug';
};

export type ReadinessInput = {
  openBugs: SeverityCounts;
  criticalBugDetails: Array<{ id: string; title: string }>;
  /** 0-100 pass rate, or null when no run data exists (signal uses neutral default). */
  testPassRate: number | null;
  /** 0-100 average AI quality, or null when no scored reports exist (signal uses neutral default). */
  avgQualityScore: number | null;
};

export type SignalKey = 'bugs' | 'tests' | 'quality';

export type SignalBreakdown = {
  key: SignalKey;
  label: string;
  /** Weight in [0, 1]. */
  weight: number;
  /** Signal value before weighting, in [0, 100]. */
  raw: number;
  /** Contribution to the final score after weighting. */
  weightedContribution: number;
  /** Maximum possible weighted contribution for this signal (= weight * 100). */
  maxContribution: number;
  /** Optional explanation when the signal used a default (no data). */
  note?: string;
};

export type ReadinessResult = {
  /** Integer 0-100. */
  score: number;
  verdict: Verdict;
  breakdown: SignalBreakdown[];
  blockers: Blocker[];
};
