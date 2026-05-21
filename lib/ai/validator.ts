// ═══════════════════════════════════════════════════════════════
// AI Output Validator
// Silently validates and improves AI outputs before showing to user.
// ═══════════════════════════════════════════════════════════════

const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'];

export function validateBugAnalysis(result: Record<string, unknown>): Record<string, unknown> {
  if (!VALID_SEVERITIES.includes(result.severity as string)) {
    result.severity = 'MEDIUM';
  }

  if (!VALID_PRIORITIES.includes(result.priority as string)) {
    result.priority = 'P2';
  }

  const steps = result.stepsToReproduce as string[] | undefined;
  if (steps) {
    result.stepsToReproduce = steps.map((step) => (step.length < 10 ? `${step} (specify details)` : step));
  }

  if (!Array.isArray(result.rootCauseHypotheses)) result.rootCauseHypotheses = [];
  if (!Array.isArray(result.affectedModules)) result.affectedModules = [];
  if (!Array.isArray(result.tags)) result.tags = [];

  if (typeof result.title === 'string' && result.title.length > 120) {
    result.title = result.title.substring(0, 117) + '...';
  }

  return result;
}
