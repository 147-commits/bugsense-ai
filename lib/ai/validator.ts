// ═══════════════════════════════════════════════════════════════
// AI Output Validator
// Silently validates and improves AI outputs before showing to user
// No disclaimers — just better outputs
// ═══════════════════════════════════════════════════════════════

// Validate bug analysis output
export function validateBugAnalysis(result: Record<string, unknown>): Record<string, unknown> {
  // Ensure severity is valid
  const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  if (!validSeverities.includes(result.severity as string)) {
    result.severity = 'MEDIUM'; // Safe default
  }

  // Ensure priority is valid
  const validPriorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
  if (!validPriorities.includes(result.priority as string)) {
    result.priority = 'P2';
  }

  // Ensure steps aren't vague - flag for refinement
  const steps = result.stepsToReproduce as string[];
  if (steps) {
    result.stepsToReproduce = steps.map((step) => {
      // Remove vague steps
      if (step.length < 10) return `${step} (specify details)`;
      return step;
    });
  }

  // Ensure arrays exist
  if (!Array.isArray(result.rootCauseHypotheses)) result.rootCauseHypotheses = [];
  if (!Array.isArray(result.affectedModules)) result.affectedModules = [];
  if (!Array.isArray(result.tags)) result.tags = [];

  // Ensure title isn't too long
  if (typeof result.title === 'string' && result.title.length > 120) {
    result.title = result.title.substring(0, 117) + '...';
  }

  return result;
}

// Validate test cases output
export function validateTestCases(testCases: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return testCases.map((tc, i) => {
    // Ensure each test case has an ID
    if (!tc.id) tc.id = `TC-${String(i + 1).padStart(3, '0')}`;

    // Ensure steps are concrete (not vague)
    if (Array.isArray(tc.steps)) {
      tc.steps = (tc.steps as string[]).filter((step) => step.length > 5);
    }

    // Ensure expected result exists
    if (!tc.expectedResult || (tc.expectedResult as string).length < 5) {
      tc.expectedResult = 'Verify the expected behavior matches requirements';
    }

    // Ensure valid priority
    const validPriorities = ['P0', 'P1', 'P2', 'P3'];
    if (!validPriorities.includes(tc.priority as string)) {
      tc.priority = 'P2';
    }

    return tc;
  });
}

// Validate generated code — basic syntax checks
export function validateCodeOutput(code: string, framework: string): { code: string; isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for common issues
  if (framework === 'playwright') {
    if (!code.includes('import') && !code.includes('require')) {
      issues.push('Missing imports');
    }
    if (code.includes('browser.newPage') && !code.includes('browser.newContext')) {
      // Old API pattern — flag it
      issues.push('Uses older Playwright API pattern');
    }
  }

  if (framework === 'cypress') {
    if (code.includes('async') && code.includes('cy.')) {
      issues.push('Cypress commands should not use async/await');
    }
  }

  // Check for placeholder text that AI sometimes generates
  const placeholders = ['TODO', 'FIXME', 'your-', 'example.com', 'replace with'];
  placeholders.forEach((p) => {
    if (code.toLowerCase().includes(p.toLowerCase())) {
      issues.push(`Contains placeholder: "${p}" — update before using`);
    }
  });

  return {
    code,
    isValid: issues.length === 0,
    issues,
  };
}

// Clean up any generic/vague AI language
export function cleanAIText(text: string): string {
  // Remove wishy-washy language
  const replacements: [RegExp, string][] = [
    [/it is possible that /gi, ''],
    [/it might be the case that /gi, ''],
    [/it seems like /gi, ''],
    [/perhaps /gi, ''],
    [/it appears that /gi, ''],
    [/in some cases, /gi, ''],
    [/generally speaking, /gi, ''],
  ];

  let cleaned = text;
  replacements.forEach(([pattern, replacement]) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // Capitalize first letter after cleanup
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}
