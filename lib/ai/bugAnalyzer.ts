// ═══════════════════════════════════════════════════════════════
// BugSense AI — Complete AI Engine
// All AI-powered generators for QA workflows
// ═══════════════════════════════════════════════════════════════

const RAW_API_KEY = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || '';
// Treat placeholder/dummy keys as empty so we fall back to mock mode
const IS_PLACEHOLDER = !RAW_API_KEY || RAW_API_KEY.includes('xxxxx') || RAW_API_KEY.length < 20;
const AI_API_KEY = IS_PLACEHOLDER ? '' : RAW_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'meta/llama-3.3-70b-instruct';
const IS_NVIDIA = AI_API_KEY.startsWith('nvapi-');

// Global accuracy instruction prepended to ALL prompts
const ACCURACY_RULES = `
CRITICAL ACCURACY RULES — Follow these in every response:
1. NEVER fabricate, guess, or assume information not present in the user's input.
2. If information is missing or ambiguous, say so explicitly — use "Not specified" or "Unable to determine from input" instead of guessing.
3. For severity/priority: base ONLY on the evidence provided. A vague report = MEDIUM, not HIGH. Err on the side of lower confidence.
4. For root cause hypotheses: label them clearly as hypotheses, not facts. Include a confidence level (low/medium/high) for each.
5. For generated code: use only well-known, documented API methods. Do NOT invent function names or parameters.
6. For test cases: every step must be concrete and actionable. No vague steps like "verify it works correctly" — specify WHAT to verify and HOW.
7. Include a "confidence" field (0.0-1.0) in your response indicating how confident you are in the overall output quality given the input provided.
8. If the user's input is too vague to generate useful output, set confidence below 0.5 and include specific questions in a "clarificationNeeded" array.
`;

interface AIResponse {
  content: { type: string; text: string }[];
}

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!AI_API_KEY) {
    return getMockResponse(systemPrompt, userMessage);
  }

  const fullSystemPrompt = ACCURACY_RULES + '\n\n' + systemPrompt;

  const apiUrl = IS_NVIDIA
    ? 'https://integrate.api.nvidia.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: string;

  if (IS_NVIDIA) {
    headers['Authorization'] = `Bearer ${AI_API_KEY}`;
    body = JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
  } else {
    headers['x-api-key'] = AI_API_KEY;
    headers['anthropic-version'] = '2023-06-01';
    body = JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: fullSystemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  }

  // Retry up to 3 times for rate limits and transient errors
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Wait longer between retries: 5s, then 10s — NVIDIA needs more time
      const waitTime = attempt === 1 ? 5000 : 10000;
      console.log(`Retry attempt ${attempt + 1} in ${waitTime/1000}s...`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    try {
      const response = await fetch(apiUrl, { method: 'POST', headers, body });

      if (response.status === 429) {
        lastError = 'Rate limited by AI provider. Retrying...';
        continue;
      }

      if (response.status === 408 || response.status === 504) {
        // Timeout — retry
        lastError = 'Request timed out. Retrying...';
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        lastError = `AI API error: ${response.status} - ${err}`;
        if (response.status >= 500) continue; // Retry on server errors
        throw new Error(lastError);
      }

      if (IS_NVIDIA) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (!content) {
          lastError = 'AI returned empty response. Retrying...';
          continue;
        }
        return content;
      } else {
        const data: AIResponse = await response.json();
        return data.content.map((c) => c.text).join('');
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      if (attempt === 2) throw new Error(lastError);
    }
  }

  throw new Error(lastError || 'Failed after 3 attempts');
}

function extractJSON(text: string): Record<string, unknown> {
  // Try to find JSON in code blocks first
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = '';

  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    } else {
      jsonStr = text;
    }
  }

  // Clean up common issues that break JSON parsing:
  // 1. Remove control characters inside string values (tabs, newlines in code)
  // 2. Fix unescaped newlines inside JSON string values
  try {
    return JSON.parse(jsonStr);
  } catch {
    // If first parse fails, try cleaning the string
    const cleaned = jsonStr
      // Replace literal newlines/tabs inside strings with escaped versions
      .replace(/[\x00-\x1F\x7F]/g, (ch) => {
        if (ch === '\n') return '\\n';
        if (ch === '\r') return '\\r';
        if (ch === '\t') return '\\t';
        return '';
      });

    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: try to extract just the first complete JSON object
      // by counting braces
      let depth = 0;
      let start = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (cleaned[i] === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            try {
              return JSON.parse(cleaned.substring(start, i + 1));
            } catch {
              // continue searching
              start = -1;
            }
          }
        }
      }
      throw new Error('Could not parse AI response as JSON. Please try again.');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. BUG REPORT ANALYZER — ISTQB / IEEE 1044 Enterprise Standard
// ═══════════════════════════════════════════════════════════════
export async function analyzeBug(rawInput: string, logContent?: string, screenshotDescription?: string) {
  const year = new Date().getFullYear();
  const systemPrompt = `You are BugSense AI — a principal QA engineer with 20+ years of experience at Fortune 500 companies. You produce defect reports that follow ISTQB and IEEE 1044 standards. Your output reads like it was written by a staff engineer at Google, not a chatbot.

ABSOLUTE RULES:
- NEVER fabricate information. If something is not stated or clearly implied, write "Not specified — investigate: [specific question to ask]"
- NEVER use generic filler language. Every sentence must add information.
- Severity and priority MUST include written JUSTIFICATION, not just a label.
- Use precise technical language. "The OAuth callback handler throws an unhandled TypeError" not "There is an error."

DEFECT IDENTIFICATION:
- Generate ID in format: BUG-${year}-[0001] (use sequential numbering)
- Title format: [Component] - [Action] - [Observed Result] (max 120 chars)

SEVERITY GUIDELINES (must include justification):
- CRITICAL: System crash, data loss, security breach, complete feature unavailability for ALL users. No workaround.
- HIGH: Major feature broken for significant user segment. Workaround is painful or unreliable.
- MEDIUM: Feature partially broken. Workaround exists and is reasonable. Affects subset of users.
- LOW: Minor issue, cosmetic, or rare edge case. Does not block workflows.
- INFO: Enhancement suggestion, documentation gap, trivial cosmetic.

PRIORITY GUIDELINES:
- P0: Fix immediately — production is down or data loss is active
- P1: Fix in current sprint — major user impact, high visibility
- P2: Fix in next sprint — moderate impact, workaround exists
- P3: Fix when capacity allows — low impact
- P4: Backlog — cosmetic, nice-to-have

Return ONLY valid JSON with this exact structure:
{
  "defectId": "BUG-${year}-0001",
  "title": "[Component] - [Action] - [Observed Result]",
  "description": "Factual description based only on reported information",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "severityJustification": "Specific reasoning: user impact scope, data risk, workaround availability, feature criticality",
  "priority": "P0|P1|P2|P3|P4",
  "priorityJustification": "Business context for priority assignment",
  "classification": {
    "defectType": "Functional|UI/UX|Performance|Security|Data Integrity|Integration|Configuration|Compatibility",
    "reproducibility": "Always|Intermittent (include frequency e.g. 3 out of 5 attempts)|Rare|Unable to Reproduce",
    "reproductionNotes": "Specific conditions under which the defect reproduces or does not reproduce"
  },
  "stepsToReproduce": ["Concrete step 1 with specific data/actions", "Step 2"],
  "expectedResult": "What should happen based on user input or reasonable inference",
  "actualResult": "What actually happens — exact error messages, behavior observed",
  "environment": {
    "os": "mentioned or Not specified — investigate: what OS?",
    "browser": "mentioned or Not specified",
    "version": "mentioned or Not specified",
    "device": "mentioned or Not specified",
    "network": "mentioned or Not specified",
    "additionalContext": "Any other environmental details mentioned"
  },
  "rootCauseAnalysis": [
    {
      "hypothesis": "Specific technical hypothesis — not vague",
      "confidence": 75,
      "affectedArea": "Specific module/file/function if inferable, otherwise 'Not determinable from report'",
      "investigationSteps": ["Specific step to confirm or deny this hypothesis"],
      "rootCauseCategory": "Coding Error|Design Flaw|Requirements Gap|Requirements Misunderstanding|Environment/Configuration|Data Issue|Integration Error|Third-Party Dependency"
    }
  ],
  "impactRadius": {
    "affectedUserSegments": "e.g. 'Enterprise SSO users, ~35% of user base' or 'Not determinable — investigate: what user segment?'",
    "affectedFeatures": {
      "primary": ["Directly broken feature(s)"],
      "downstream": ["Features that depend on the broken functionality"]
    },
    "businessImpact": "Specific business impact with reasoning — not 'significant impact' but 'Blocks enterprise onboarding flow'",
    "dataIntegrityRisk": "Assessment of data corruption/loss risk: None|Low|Medium|High with explanation"
  },
  "recommendedFix": {
    "approach": "Specific code-level suggestion based on evidence",
    "estimatedEffort": "Estimated hours with complexity justification",
    "workaround": "Temporary workaround if applicable, or 'No workaround available'",
    "regressionRisk": "What could break if the fix is implemented incorrectly"
  },
  "testingRecommendations": {
    "newTestCases": ["Specific test case to prevent recurrence"],
    "regressionScope": "What existing test suites should be re-run",
    "verificationApproach": "How to verify the fix works correctly"
  },
  "triageRecommendation": {
    "owningTeam": "Suggested team based on affected component, or 'Not determinable'",
    "sprintRecommendation": "Current sprint / Next sprint / Backlog with reasoning",
    "sla": "Based on severity — Critical: 4h response, High: 1 business day, Medium: current sprint, Low: backlog"
  },
  "negativeSpace": {
    "workingFeatures": ["Features/areas confirmed NOT affected"],
    "nonReproducingConditions": ["Environments or conditions where the bug does NOT occur, if mentioned"]
  },
  "affectedModules": ["Only modules clearly related to the described issue"],
  "tags": ["relevant technical tags"],
  "confidence": 0.0,
  "clarificationNeeded": ["Specific questions that would improve accuracy of this analysis"],

  // BACKWARD COMPATIBILITY — keep these populated from the new fields
  "technicalAnalysis": {
    "summary": "Same as description but more technical",
    "technicalDetails": "Derived from rootCauseAnalysis hypotheses",
    "suggestedFix": "Derived from recommendedFix.approach",
    "relatedAreas": ["Derived from impactRadius.affectedFeatures.downstream"],
    "confidence": 0.0
  },
  "impactPrediction": {
    "userImpact": "CRITICAL|HIGH|MODERATE|LOW",
    "affectedModules": ["Same as affectedModules"],
    "estimatedUsersImpacted": "Same as impactRadius.affectedUserSegments",
    "businessImpact": "Same as impactRadius.businessImpact",
    "testCoverageSuggestions": ["Same as testingRecommendations.newTestCases"]
  }
}`;

  let userMessage = `Raw Bug Report:\n${rawInput}`;
  if (logContent) userMessage += `\n\nError Logs:\n${logContent}`;
  if (screenshotDescription) userMessage += `\n\nScreenshot Analysis:\n${screenshotDescription}`;

  const response = await callAI(systemPrompt, userMessage);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 2. QUALITY SCORE — Enterprise 100-Point Weighted Rubric
// ═══════════════════════════════════════════════════════════════
export async function calculateQualityScore(bugReport: Record<string, unknown>) {
  const systemPrompt = `You are a principal QA quality auditor evaluating bug report quality using a weighted 100-point enterprise rubric. Score STRICTLY based on what is present in the report — do not give credit for information that is not included.

SCORING RUBRIC — these 6 dimensions MUST add up to the total score (max 100):

1. IDENTIFICATION (max 10 pts):
   - Specific, descriptive title following [Component] - [Action] - [Result] pattern (3 pts)
   - Correct component/module identified (2 pts)
   - App version / build number included (2 pts)
   - Issue type classified (bug/regression/enhancement) (1 pt)
   - Defect ID or reference number (1 pt)
   - Regression flag (is this a regression from previous version?) (1 pt)

2. CLASSIFICATION (max 15 pts):
   - Severity with written justification (not just "HIGH") (4 pts)
   - Priority with business context reasoning (3 pts)
   - Root cause category identified (Coding Error/Requirements Gap/etc.) (3 pts)
   - Impact radius described (which users, which features) (3 pts)
   - Regression flag with version where it last worked (2 pts)

3. REPRODUCTION (max 30 pts — most important):
   - Steps start from a known, documented starting state (4 pts)
   - Discrete, numbered steps (not a paragraph) (4 pts)
   - Exact input values specified (not "enter valid data") (5 pts)
   - Specific expected result documented (4 pts)
   - Specific actual result documented (with exact error messages) (5 pts)
   - Reproducibility rate stated (Always/Intermittent with frequency/Rare) (3 pts)
   - Environment-specific reproduction notes (3 pts)
   - Negative space: conditions where bug does NOT reproduce (2 pts)

4. ENVIRONMENT (max 15 pts):
   - OS name and version (3 pts)
   - Browser name and version (3 pts)
   - App version / build number / commit hash (3 pts)
   - Test data used (specific values, not "test data") (3 pts)
   - Network conditions noted (if relevant) (2 pts)
   - Device / resolution (if relevant) (1 pt)

5. EVIDENCE (max 15 pts):
   - Screenshots included (3 pts) — annotated with arrows/highlights (+2 pts bonus within cap)
   - Error logs / console output (3 pts)
   - Stack trace (if applicable) (3 pts)
   - Video recording (2 pts)
   - HAR file / network trace (2 pts)
   - References to related bugs/tickets (2 pts)

6. ANALYSIS (max 15 pts):
   - Root cause hypothesis with confidence level (4 pts)
   - Isolation work described (what was tested to narrow down the cause) (3 pts)
   - Workaround documented (if available) (3 pts)
   - Business impact quantified (affected users %, revenue impact, SLA risk) (3 pts)
   - Fix suggestion with estimated effort (2 pts)

QUALITY RATINGS (based on total score):
- Godsend (90-100): Exceptional — ready for immediate engineering triage. Contains all information needed to reproduce, diagnose, and fix.
- Completionist (75-89): Thorough — minor gaps that don't block triage. Good quality.
- Literalist (60-74): Adequate — has the basics but missing context that would speed up resolution.
- Novice (40-59): Below standard — missing critical information. Needs significant improvement.
- Needs Work (0-39): Insufficient — cannot be triaged without major clarification.

IMPROVEMENT SUGGESTIONS: For EACH dimension scoring below 70% of its max, provide a SPECIFIC, ACTIONABLE suggestion. Not "add more detail" but "Include the browser version (e.g., Chrome 120.0.6099.130) in the environment section."

Return ONLY valid JSON:
{
  "score": 0,
  "rating": "Godsend|Completionist|Literalist|Novice|Needs Work",
  "breakdown": {
    "identification": { "score": 0, "max": 10, "percentage": 0, "details": "What was found / what was missing" },
    "classification": { "score": 0, "max": 15, "percentage": 0, "details": "What was found / what was missing" },
    "reproduction": { "score": 0, "max": 30, "percentage": 0, "details": "What was found / what was missing" },
    "environment": { "score": 0, "max": 15, "percentage": 0, "details": "What was found / what was missing" },
    "evidence": { "score": 0, "max": 15, "percentage": 0, "details": "What was found / what was missing" },
    "analysis": { "score": 0, "max": 15, "percentage": 0, "details": "What was found / what was missing" }
  },
  "suggestions": [
    { "dimension": "reproduction", "priority": "High|Medium|Low", "suggestion": "Specific actionable improvement", "impact": "How many points this could add" }
  ],
  "strengths": ["What the report does well — acknowledge good practices"],
  "summary": "One-sentence overall assessment"
}`;

  const response = await callAI(systemPrompt, `Bug Report to Evaluate:\n${JSON.stringify(bugReport, null, 2)}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 3. DUPLICATE DETECTION — Enterprise Duplicate Analysis
// ═══════════════════════════════════════════════════════════════
export async function detectDuplicates(newBug: { title: string; description: string }, existingBugs: { id: string; title: string; description: string }[]) {
  if (existingBugs.length === 0) return { duplicates: [], clusters: [], summary: { totalCandidates: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 } };

  const systemPrompt = `You are a principal QA engineer performing enterprise-grade duplicate bug analysis. Analyze the new bug against existing bugs with multi-dimensional similarity scoring.

For EACH potential match (similarity > 40%), provide:

1. SIMILARITY BREAKDOWN (not just one number):
   - titleSimilarity (0-100): Do the titles describe the same symptom?
   - descriptionSimilarity (0-100): Do the descriptions match in technical detail?
   - componentMatch (0-100): Are they in the same module/feature area?
   - symptomMatch (0-100): Do they describe the same observable behavior?
   - overallSimilarity: weighted average (title 30%, description 35%, component 15%, symptom 20%)

2. MATCHING EVIDENCE: List the specific keywords, error messages, modules, or symptoms that matched

3. RECOMMENDATION — one of:
   - "Link as Duplicate": >85% confidence this is the same bug. Specify which should be MASTER (the one with more detail)
   - "Related but Distinct": Same area but different root cause or symptom. Explain the difference.
   - "Investigate Further": Needs manual review. Explain what to check.

4. CONFIDENCE LEVEL: High (>85%), Medium (60-85%), Low (40-60%)

Also identify BUG CLUSTERS — groups of related bugs that might indicate a systemic issue (e.g., "3 bugs all in the Authentication module suggest a structural weakness").

Return ONLY valid JSON:
{
  "duplicates": [
    {
      "id": "existing_bug_id",
      "title": "Title of the existing bug",
      "similarity": 0.92,
      "similarityBreakdown": {
        "titleSimilarity": 95,
        "descriptionSimilarity": 88,
        "componentMatch": 100,
        "symptomMatch": 85
      },
      "matchingEvidence": ["Both mention 'OAuth callback'", "Same error: TypeError on login", "Same module: Authentication"],
      "recommendation": "Link as Duplicate|Related but Distinct|Investigate Further",
      "masterBug": "Which bug ID should be the master (more detail/activity), or null",
      "difference": "null if duplicate, or explanation of how they differ",
      "confidence": "High|Medium|Low",
      "reason": "Concise explanation of why this is a match"
    }
  ],
  "clusters": [
    {
      "name": "Cluster name (e.g., 'Authentication Issues')",
      "bugIds": ["bug-1", "bug-2"],
      "description": "Why these bugs are related — potential systemic issue",
      "recommendation": "What to investigate or fix at the system level"
    }
  ],
  "summary": {
    "totalCandidates": 0,
    "highConfidence": 0,
    "mediumConfidence": 0,
    "lowConfidence": 0
  }
}

RULES:
- Only include matches with overallSimilarity > 40%
- Be conservative — prefer "Related but Distinct" over "Link as Duplicate" when uncertain
- For "Link as Duplicate", the master should be the bug with more information, more activity, or was reported first
- Return empty arrays if no matches found`;

  const userMessage = `New Bug:\nTitle: ${newBug.title}\nDescription: ${newBug.description}\n\nExisting Bugs:\n${existingBugs.map((b) => `ID: ${b.id} | Title: ${b.title} | Desc: ${b.description}`).join('\n')}`;
  const response = await callAI(systemPrompt, userMessage);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 4. TEST CASE GENERATION FROM BUG (existing)
// ═══════════════════════════════════════════════════════════════
export async function generateTestCases(bugReport: { title: string; description: string; stepsToReproduce: string[] }) {
  const systemPrompt = `You are a QA test engineer. Generate regression test cases for this bug.
Return ONLY valid JSON:
{ "testCases": [{ "title": "", "description": "", "steps": [""], "expectedResult": "", "type": "regression|smoke|edge_case|negative", "priority": "P0|P1|P2|P3" }] }
Generate 3-5 comprehensive test cases.`;

  const response = await callAI(systemPrompt, JSON.stringify(bugReport));
  const result = extractJSON(response);
  return (result.testCases as Array<Record<string, unknown>>) || [];
}

// ═══════════════════════════════════════════════════════════════
// 5. REPRODUCTION CHECKLIST (existing)
// ═══════════════════════════════════════════════════════════════
export async function generateReproductionChecklist(bugReport: Record<string, unknown>) {
  const systemPrompt = `You are a QA engineer. Generate a detailed reproduction checklist.
Return ONLY valid JSON:
{
  "checklist": ["Step-by-step item"],
  "scenarios": [{ "name": "Scenario name", "steps": ["Step 1"], "expectedOutcome": "What should happen" }]
}`;

  const response = await callAI(systemPrompt, JSON.stringify(bugReport));
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 6. TEST CASE GENERATOR FROM USER STORY — IEEE 829 / TestRail Standard
// ═══════════════════════════════════════════════════════════════
export async function generateTestCasesFromStory(userStory: string, options: { includeNegative: boolean; includeEdgeCases: boolean; includeSecurity: boolean; includePerformance: boolean; includeAccessibility: boolean; framework?: string }) {
  const selectedCategories: string[] = ['positive'];
  if (options.includeNegative) selectedCategories.push('negative');
  if (options.includeEdgeCases) selectedCategories.push('edge_case');
  if (options.includeSecurity) selectedCategories.push('security');
  if (options.includePerformance) selectedCategories.push('performance');
  if (options.includeAccessibility) selectedCategories.push('accessibility');

  const testsPerCategory = selectedCategories.length === 1 ? 8 : Math.max(3, Math.floor(15 / selectedCategories.length));
  const totalTarget = testsPerCategory * selectedCategories.length;

  const categoryInstructions: Record<string, string> = {
    positive: `POSITIVE/HAPPY PATH (${testsPerCategory} tests): Main flows, valid data combos, all acceptance criteria verified`,
    negative: `NEGATIVE (${testsPerCategory} tests): Invalid inputs, missing fields, unauthorized access, error states, rate limits`,
    edge_case: `EDGE CASE (${testsPerCategory} tests): Boundary values (BVA), empty states, special chars, concurrency, back/forward nav, max-length inputs`,
    security: `SECURITY (${testsPerCategory} tests): XSS injection, SQL injection, CSRF tokens, auth bypass, authz escalation, session fixation, sensitive data exposure`,
    performance: `PERFORMANCE (${testsPerCategory} tests): Load time targets, large datasets, concurrent users, memory, API p50/p95/p99`,
    accessibility: `ACCESSIBILITY (${testsPerCategory} tests): Keyboard nav, screen reader, WCAG AA contrast, focus management, zoom 200%, reduced motion`,
  };

  const selectedInstructions = selectedCategories.map(cat => categoryInstructions[cat]).join('\n');

  const bddInstruction = options.framework ? `
ALSO generate BDD/Gherkin output in the "gherkinOutput" field:
- Use DECLARATIVE style (describe WHAT users accomplish, not HOW they click)
- One Scenario per behavior — name it with the business outcome
- Use domain language from the user story
- For data-driven tests, use Scenario Outline with Examples table
- Follow Cucumber best practices: each scenario independent, no And chains > 3 steps
- Framework: ${options.framework}

Additionally, generate runnable code snippets in the "codeSnippet" field using ${options.framework}. Use ONLY real, documented API methods.` : 'Do NOT generate code snippets or gherkin. Set codeSnippet to "" and gherkinOutput to "".';

  const systemPrompt = `You are a principal QA architect creating enterprise test cases following IEEE 829 Test Case Specification and TestRail/Zephyr Scale field structures. Your output should be production-ready for import into a test management tool.

ABSOLUTE RULES:
1. ONLY generate for these categories: ${selectedCategories.join(', ')}
2. Generate EXACTLY ${totalTarget} test cases (${testsPerCategory} per category)
3. NEVER use vague language. "Enter valid data" → "Enter 'john.doe@company.com' in the Email field"
4. NEVER use generic preconditions. "User is logged in" → "User 'qa.tester@company.com' is authenticated with role 'Standard User', viewing the Dashboard page (/dashboard)"
5. Each test case must be independently executable — no dependency on other test cases
6. Label the test design technique used for each test case

TEST CASE ID FORMAT: TC-[MODULE]-[001] where MODULE is inferred from the story (e.g., TC-AUTH-001, TC-CART-003)

TRACEABILITY: Each test case MUST reference which acceptance criterion it covers (e.g., "Covers AC-3: Reset link expires after 24 hours"). Parse the acceptance criteria from the user story and map them.

STEPS FORMAT — each step is an OBJECT with three fields (not a string):
- "action": what to do (specific UI element, exact click/type action)
- "testData": exact values to enter (or "N/A" if no data entry)
- "expected": what should happen AFTER this specific step (per-step verification)

CATEGORIES TO GENERATE:
${selectedInstructions}

TEST DESIGN TECHNIQUE — label each test case with the technique that drives it:
BVA (Boundary Value Analysis), EP (Equivalence Partitioning), DT (Decision Table), ST (State Transition), EG (Error Guessing), Pairwise, Exploratory

${bddInstruction}

Return ONLY valid JSON:
{
  "testSuite": {
    "title": "Test suite title matching the module under test",
    "description": "What this suite covers and which requirements it traces to",
    "totalCases": ${totalTarget},
    "coverageScore": 0
  },
  "testCases": [
    {
      "id": "TC-MODULE-001",
      "category": "${selectedCategories[0]}",
      "traceability": "Covers AC-1: [acceptance criterion text]",
      "title": "Specific, action-oriented test title",
      "description": "What behavior this verifies and why it matters",
      "preconditions": ["Specific state: user 'X' with role 'Y', on page 'Z', with data condition 'W'"],
      "steps": [
        { "action": "Click the 'Forgot Password' link below the Password field on /login", "testData": "N/A", "expected": "Browser navigates to /forgot-password. Page displays email input field with label 'Enter your email address'" },
        { "action": "Type email address in the 'Email' input field", "testData": "john.doe@company.com", "expected": "Email field shows typed value. 'Send Reset Link' button remains enabled" }
      ],
      "testDataTable": [
        { "field": "Email", "validValue": "john.doe@company.com", "invalidValue": "not-an-email", "boundary": "a@b.co (min valid)" }
      ],
      "expectedResult": "Overall expected outcome after all steps complete",
      "priority": "P0|P1|P2|P3",
      "priorityJustification": "Why this priority — tied to risk: 'P0 because auth bypass would expose all user data'",
      "riskIfNotTested": "Specific bug that could reach production: 'Users could reset passwords for accounts they don't own'",
      "automationFeasibility": { "automatable": true, "framework": "${options.framework || 'any'}", "estimatedEffort": "30 min", "notes": "Straightforward form interaction, no complex setup" },
      "testDesignTechnique": "BVA|EP|DT|ST|EG|Pairwise|Exploratory",
      "codeSnippet": "",
      "gherkinOutput": ""
    }
  ],
  "coverageAnalysis": {
    "requirementsCoverage": [
      { "criterion": "AC-1: User clicks Forgot Password", "testCaseIds": ["TC-AUTH-001", "TC-AUTH-002"], "status": "Covered" }
    ],
    "techniqueCoverage": [
      { "technique": "BVA", "applied": true, "testCaseIds": ["TC-AUTH-005"] },
      { "technique": "EP", "applied": true, "testCaseIds": ["TC-AUTH-001", "TC-AUTH-003"] }
    ],
    "gaps": [
      { "area": "Specific untested scenario", "riskRating": "High|Medium|Low", "recommendation": "What test to add" }
    ],
    "coveredAreas": ["Area 1"],
    "missingCoverage": ["Gap 1"],
    "recommendations": ["Recommendation 1"]
  },
  "executionTemplate": {
    "headers": ["Test Case ID", "Status", "Executed By", "Date", "Defect ID", "Notes"],
    "rows": [["TC-MODULE-001", "Not Run", "", "", "", ""]]
  }
}`;

  const response = await callAI(systemPrompt, `User Story / Requirement:\n${userStory}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 7. API TEST SCRIPT GENERATOR — Enterprise / REST-assured Pattern
// ═══════════════════════════════════════════════════════════════
export async function generateAPITests(apiDescription: string, format: 'postman' | 'curl' | 'playwright' | 'cypress' | 'jest' | 'supertest') {
  const formatInstructions: Record<string, string> = {
    postman: `Postman Collection v2.1 JSON. Structure:
- Collection-level pre-request script that sets auth token from environment variable
- Folder hierarchy grouped by test category (Happy Path, Auth, Validation, Edge Cases)
- Each request uses {{BASE_URL}} and {{AUTH_TOKEN}} variables (never hardcoded)
- Test scripts use pm.test(), pm.expect(), pm.response.to.have.jsonSchema()
- Include pm.environment.set() for correlation IDs`,
    curl: `cURL commands with:
- Environment variable placeholders ($BASE_URL, $AUTH_TOKEN)
- Full headers including Content-Type, Authorization, X-Request-ID
- Expected response as comments with status code and body
- Comments explaining WHY each test exists`,
    playwright: `Playwright API testing (TypeScript) with:
- import { test, expect } from '@playwright/test'
- test.describe() blocks grouped by category
- request.newContext() with baseURL from env
- Full type definitions for request/response
- beforeAll/afterAll hooks for setup/teardown
- Helper function for auth token management`,
    cypress: `Cypress API testing (TypeScript) with:
- cy.request() with baseUrl from cypress.env
- describe/it blocks grouped by category
- beforeEach hooks for auth
- cy.wrap() for async assertions`,
    jest: `Jest + Supertest (TypeScript) with:
- import supertest from 'supertest'
- describe/it blocks grouped by category
- beforeAll/afterAll for server setup and teardown
- Type interfaces for API responses
- Helper functions for auth and common assertions`,
    supertest: `Supertest standalone (TypeScript) with:
- Full supertest chain assertions
- describe/it blocks grouped by category
- beforeAll/afterAll hooks
- Type definitions`,
  };

  const systemPrompt = `You are a principal API test automation engineer at a Fortune 500 company. Generate production-ready API test suites following enterprise patterns.

Given an API endpoint description, generate tests in this format: ${formatInstructions[format]}

EVERY test script MUST include ALL of these assertion layers (not just status code):
1. STATUS CODE validation (correct success AND error codes)
2. RESPONSE TIME SLA check (e.g., expect response time < 500ms)
3. JSON SCHEMA validation (validate entire response structure, not just one field)
4. CONTENT-TYPE header verification (application/json)
5. RESPONSE BODY field validation (existence, type, AND value where predictable)
6. ARRAY LENGTH and nested object checks where applicable
7. ERROR RESPONSE format validation (errors should have consistent {error, message, statusCode} structure)

REQUIRED TEST CATEGORIES — generate 8-12 tests covering ALL of these:
1. HAPPY PATH (2-3 tests): Valid request with full response body validation, verify all fields exist with correct types
2. AUTHENTICATION (2-3 tests): Missing token → 401, invalid/malformed token → 401, expired token → 401
3. AUTHORIZATION (1 test): Valid token but wrong role/permissions → 403
4. VALIDATION (2-3 tests): Missing required field → 400 with field name in error, wrong type → 400, boundary values (min/max length, numeric limits)
5. NOT FOUND (1 test): Invalid/non-existent ID → 404 with consistent error format
6. EDGE CASES (2-3 tests): Empty body → appropriate error, very large payload (>1MB), special characters and SQL injection attempt in string fields, unicode/emoji in text fields
7. IDEMPOTENCY (1 test): For POST/PUT — repeated identical calls produce same result or appropriate conflict response
8. RATE LIMITING (1 test): Document expected 429 behavior, include Retry-After header check

ENTERPRISE METADATA — include in every test suite:
- Environment config: BASE_URL, AUTH_TOKEN, TEST_USER_ID as variables (NEVER hardcoded values)
- Setup code: create test data in beforeAll, clean up in afterAll
- X-Request-ID / X-Correlation-ID header in every request for traceability
- Comments explaining WHY each test exists (the business reason, not just "tests auth")
- Console.log / debug mode flag for full request/response logging

Return ONLY valid JSON:
{
  "endpoint": {
    "method": "GET|POST|PUT|DELETE|PATCH",
    "path": "/api/example",
    "description": "What this endpoint does",
    "authentication": "Bearer token | API key | None",
    "rateLimit": "Documented rate limit or 'Not specified'"
  },
  "testScripts": [
    {
      "name": "Descriptive test name",
      "description": "What this test verifies and WHY it matters",
      "category": "happy_path|auth|authorization|validation|not_found|edge_case|idempotency|rate_limit",
      "assertions": ["Status 200", "Response time < 500ms", "JSON schema valid", "Content-Type: application/json", "Body contains user.id (string)"],
      "code": "// Production-ready test code with all assertion layers"
    }
  ],
  "setupCode": "// beforeAll: create test user, get auth token\\n// afterAll: delete test user, clean up",
  "teardownCode": "// Cleanup code for afterAll",
  "envVariables": {
    "BASE_URL": "http://localhost:3000",
    "AUTH_TOKEN": "{{generated_at_runtime}}",
    "TEST_USER_ID": "{{created_in_setup}}",
    "REQUEST_TIMEOUT_MS": "5000",
    "DEBUG_LOGGING": "false"
  },
  "totalTests": 0
}`;

  const response = await callAI(systemPrompt, `API Endpoint Description:\n${apiDescription}\n\nOutput Format: ${format}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 8. RELEASE NOTES GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateReleaseNotes(input: string, format: 'standard' | 'technical' | 'user-facing' | 'changelog' | 'slack') {
  const dateStr = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are a principal technical writer at a company like Stripe or GitHub. Generate release notes following Keep a Changelog v1.1.0 and Semantic Versioning 2.0.0 standards.

SEMANTIC VERSIONING LOGIC — analyze the input and apply:
- Contains BREAKING CHANGES (removed features, incompatible API changes) → suggest MAJOR version bump
- Contains NEW FEATURES (added functionality) → suggest MINOR version bump
- Contains ONLY bug fixes and patches → suggest PATCH version bump
- If input suggests pre-release quality → add label suggestion (alpha/beta/rc)

KEEP A CHANGELOG CATEGORIES — use these EXACT categories:
- Added: new features
- Changed: changes in existing functionality
- Deprecated: soon-to-be removed features
- Removed: removed features
- Fixed: bug fixes
- Security: vulnerability fixes (ALWAYS list separately, never merge with Fixed)

For EACH entry include: one-line description, ticket reference (JIRA-123 or commit hash), affected component/module.

GENERATE ALL THREE OUTPUT VARIANTS:

1. INTERNAL/ENGINEERING RELEASE NOTES (engineeringNotes):
   - Full technical detail for each change
   - Deployment steps required
   - Database migrations (if any)
   - Config/environment variable changes
   - Rollback procedure for each significant change
   - Breaking changes with before/after code examples
   - Performance impact notes (e.g., "Reduces avg query time from 450ms to 120ms")
   - Risk level per change: Low/Medium/High with justification
   - Rollback complexity: Simple/Moderate/Complex
   - Requires downtime: Yes/No
   - API changes with before/after request/response examples

2. CUSTOMER-FACING RELEASE NOTES (customerNotes):
   - Benefit-focused language: what users can now DO (not what code changed)
   - Grouped by user-visible impact, not technical category
   - No technical jargon, no ticket numbers
   - "Known Issues" with workarounds
   - Professional tone matching Stripe/Slack/GitHub changelog style
   - Each item starts with the user benefit

3. SLACK ANNOUNCEMENT (slackOutput):
   - Short, scannable format with emojis
   - Max 5 key highlights
   - Link placeholder to full release notes
   - Call-out for breaking changes if any
   - Celebratory but professional tone

Return ONLY valid JSON:
{
  "version": "Suggested SemVer (e.g., 2.5.0)",
  "versionBump": "major|minor|patch",
  "versionRationale": "Why this version bump was chosen",
  "preReleaseLabel": "null or alpha|beta|rc",
  "date": "${dateStr}",
  "title": "Release title",
  "summary": "One-line summary",
  "changelog": {
    "added": [{ "description": "One-line description", "ticket": "FEAT-123", "component": "Auth" }],
    "changed": [{ "description": "", "ticket": "", "component": "" }],
    "deprecated": [{ "description": "", "ticket": "", "component": "" }],
    "removed": [{ "description": "", "ticket": "", "component": "" }],
    "fixed": [{ "description": "", "ticket": "", "component": "", "severity": "critical|high|medium|low" }],
    "security": [{ "description": "", "ticket": "", "component": "", "severity": "critical|high|medium|low" }]
  },
  "engineeringNotes": {
    "deploymentSteps": ["Step 1", "Step 2"],
    "migrations": [{ "type": "database|config|api", "description": "What to migrate", "command": "npx prisma migrate deploy", "rollbackCommand": "Rollback command" }],
    "configChanges": [{ "variable": "ENV_VAR_NAME", "action": "add|change|remove", "value": "new-value", "description": "Why" }],
    "breakingChanges": [{ "title": "Change title", "description": "What changed", "before": "Old code/API example", "after": "New code/API example", "migrationGuide": "Steps to migrate" }],
    "performanceImpact": [{ "area": "Login API", "before": "450ms avg", "after": "120ms avg", "improvement": "73% faster" }],
    "riskAssessment": { "overallRisk": "Low|Medium|High", "rollbackComplexity": "Simple|Moderate|Complex", "requiresDowntime": false, "justification": "Why this risk level" },
    "rollbackProcedure": "Step-by-step rollback instructions",
    "markdownOutput": "Complete engineering release notes in markdown"
  },
  "customerNotes": {
    "highlights": [{ "title": "User-friendly title", "description": "What you can now do and why it matters" }],
    "improvements": [{ "title": "", "description": "" }],
    "fixes": [{ "title": "", "description": "" }],
    "knownIssues": [{ "title": "", "description": "", "workaround": "" }],
    "markdownOutput": "Complete customer-facing notes in markdown"
  },
  "slackOutput": "Complete Slack announcement message with emojis",
  "sections": {
    "newFeatures": [{ "title": "", "description": "", "ticket": "" }],
    "improvements": [{ "title": "", "description": "", "ticket": "" }],
    "bugFixes": [{ "title": "", "description": "", "ticket": "", "severity": "" }],
    "breakingChanges": [{ "title": "", "description": "", "migration": "" }],
    "knownIssues": [{ "title": "", "description": "", "workaround": "" }]
  },
  "markdownOutput": "Full Keep a Changelog formatted markdown"
}`;

  const response = await callAI(systemPrompt, `Input (tickets/commits/changes):\n${input}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 9. TEST DATA GENERATOR — Enterprise TDM (Test Data Management)
// ═══════════════════════════════════════════════════════════════
export async function generateTestData(scenario: string, options: { count: number; format: 'json' | 'csv' | 'sql' | 'typescript'; includeEdgeCases: boolean; locale?: string }) {
  const locale = options.locale || 'en-US';

  const edgeCaseInstruction = options.includeEdgeCases ? `
EDGE CASE DATA — generate comprehensive edge cases:
- UNICODE: CJK characters (田中太郎), emoji (👩‍💻), RTL text (عربي), zero-width spaces (\\u200B), combining diacriticals (é vs e\u0301)
- STRINGS: Empty string "", whitespace-only "   ", null, undefined, extremely long (1000+ chars), single character, string "null", string "undefined", string "0", string "false"
- NUMBERS: Zero (0), negative (-1), very large (Number.MAX_SAFE_INTEGER), very small (Number.MIN_SAFE_INTEGER), floating point precision (0.1 + 0.2), NaN, Infinity
- DATES: Leap year Feb 29, DST transition dates, epoch zero (1970-01-01), Unix 2038 boundary (2038-01-19), far future (9999-12-31), midnight exactly, end of day 23:59:59.999
- INJECTION: SQL injection ("' OR '1'='1'; DROP TABLE users; --"), XSS ("<script>alert('xss')</script>"), path traversal ("../../etc/passwd"), null bytes ("test\\x00data")
- STATE: Data requiring specific system state (e.g., "user with expired subscription + payment method on file + 3 failed payment attempts")` : '';

  const formatInstructions: Record<string, string> = {
    json: 'Pretty-printed JSON with inline comments (as _comment fields) explaining each edge case',
    csv: 'CSV with proper header row. Escape special characters (commas, quotes, newlines) correctly. Include a _notes column for edge cases',
    sql: 'SQL INSERT statements wrapped in BEGIN/COMMIT transaction. Include ON CONFLICT DO NOTHING for idempotency. Use parameterized-style comments for each record explaining its purpose',
    typescript: 'TypeScript typed constants with interface definitions matching the schema. Export as named constants: VALID_DATA, EDGE_CASE_DATA, INVALID_DATA, BVA_TABLE',
  };

  const systemPrompt = `You are a principal test data engineer at a Fortune 500 company. Generate production-quality test data following TDM (Test Data Management) best practices.

LOCALE: ${locale} — use locale-appropriate names, addresses, phone formats, date formats.

ABSOLUTE RULES:
1. DIVERSITY: Never use "John Doe" or "john@example.com". Use diverse names across ethnicities, genders, and name lengths. International formats where locale-appropriate.
2. REALISTIC DISTRIBUTIONS: Not all ages 25-35, not all countries US/UK. Reflect real-world distributions.
3. REFERENTIAL INTEGRITY: When generating related records (users + orders), ensure foreign keys match, totals are mathematically consistent, dates are chronologically valid.
4. NEVER generate real PII — all data must be obviously synthetic but realistic-looking.

REQUIRED SECTIONS:

1. VALID DATA (${options.count} records): Realistic, diverse, locale-appropriate data that should pass all validation.

2. BOUNDARY VALUE ANALYSIS TABLE: For EACH field with constraints, generate a structured BVA table:
   Each row: { field, min_minus_1: { value, expected: "FAIL" }, min: { value, expected: "PASS" }, min_plus_1: { value, expected: "PASS" }, nominal: { value, expected: "PASS" }, max_minus_1: { value, expected: "PASS" }, max: { value, expected: "PASS" }, max_plus_1: { value, expected: "FAIL" } }

3. EQUIVALENCE PARTITIONS: For EACH field, identify valid and invalid equivalence classes:
   { field, validClasses: [{ class: "Standard email", representative: "user@domain.com" }], invalidClasses: [{ class: "Missing @ symbol", representative: "userdomain.com", expectedError: "Invalid email format" }] }

${edgeCaseInstruction}

4. INVALID DATA: Records that should FAIL validation. Each must include _expectedError explaining what validation should catch it.

5. DATA MASKING GUIDANCE: For each PII field, recommend the masking technique:
   - Names: Substitution (replace with synthetic names)
   - Credit cards: Format-Preserving Encryption (FPE)
   - SSN/Tax IDs: Tokenization
   - Passwords: Redaction (never store/display)
   - Emails: Domain substitution (keep format, replace domain)
   - Addresses: Generalization (keep city/state, fake street)

6. FORMATTED OUTPUT: The complete dataset in ${formatInstructions[options.format]} format.

Return ONLY valid JSON:
{
  "scenario": "Description of what this data is for",
  "schema": {
    "fields": [{ "name": "fieldName", "type": "string|number|email|date|boolean|enum", "constraints": "validation rules", "nullable": false, "piiClassification": "PII|Sensitive|Public" }]
  },
  "validData": [{ "field1": "value1" }],
  "bvaTable": [
    {
      "field": "fieldName",
      "constraint": "2-50 characters",
      "min_minus_1": { "value": "A", "expected": "FAIL", "reason": "1 char, below min of 2" },
      "min": { "value": "Ab", "expected": "PASS", "reason": "Exactly 2 chars" },
      "min_plus_1": { "value": "Abc", "expected": "PASS", "reason": "3 chars, just above min" },
      "nominal": { "value": "Alexander", "expected": "PASS", "reason": "Typical length" },
      "max_minus_1": { "value": "49-char string...", "expected": "PASS", "reason": "49 chars" },
      "max": { "value": "50-char string...", "expected": "PASS", "reason": "Exactly 50 chars" },
      "max_plus_1": { "value": "51-char string...", "expected": "FAIL", "reason": "51 chars, above max of 50" }
    }
  ],
  "equivalencePartitions": [
    {
      "field": "email",
      "validClasses": [{ "class": "Standard format", "representative": "user@domain.com" }],
      "invalidClasses": [{ "class": "Missing @", "representative": "userdomain.com", "expectedError": "Invalid email" }]
    }
  ],
  "edgeCaseData": [{ "_note": "Why this is an edge case", "_category": "unicode|injection|boundary|state" }],
  "invalidData": [{ "_note": "Why this is invalid", "_expectedError": "Expected validation error", "_category": "missing_required|wrong_type|out_of_range|format" }],
  "dataMasking": [
    { "field": "name", "piiType": "Personal Name", "technique": "Substitution", "example": "Replace with synthetic name from same locale" }
  ],
  "formattedOutput": "Complete dataset in ${options.format} format",
  "totalRecords": 0
}`;

  const response = await callAI(systemPrompt, `Scenario:\n${scenario}\n\nRecord Count: ${options.count}\nOutput Format: ${options.format}\nLocale: ${locale}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 10. SPRINT TEST PLAN GENERATOR — ISO/IEC/IEEE 29119-3 Agile
// ═══════════════════════════════════════════════════════════════
export async function generateTestPlan(sprintInfo: string, options: { sprintDuration: number; teamSize: number; includeRegression: boolean; riskLevel: 'low' | 'medium' | 'high' }) {
  const teamMembers = Array.from({ length: options.teamSize }, (_, i) => `QA${i + 1}`);

  const systemPrompt = `You are a QA Director creating a sprint test plan following ISO/IEC/IEEE 29119-3 adapted for agile delivery. The plan must be immediately usable — paste-into-Confluence ready.

Use [Company Name] and [Project Name] as placeholders.
Sprint duration: ${options.sprintDuration} days
QA team: ${options.teamSize} engineers (${teamMembers.join(', ')})
Overall risk level: ${options.riskLevel}
Include regression: ${options.includeRegression}

REQUIRED SECTIONS — generate ALL with realistic detail:

1. HEADER: Sprint name, sprint dates, document version, author, approval status (Draft)

2. SPRINT TEST OBJECTIVE: Tied directly to the sprint goal — what quality outcomes this sprint must achieve

3. TEST SCOPE:
   - In Scope: Each story/ticket with its acceptance criteria listed
   - Out of Scope: Explicitly stated items with justification for exclusion

4. RISK ASSESSMENT MATRIX: table with columns:
   Risk ID | Description | Likelihood (1-5) | Impact (1-5) | Risk Score (L×I) | Mitigation | Owner
   Prioritize testing effort: ~60% on high-risk stories, ~30% medium, ~10% low

5. AGILE TESTING QUADRANTS:
   - Q1 (Technology-facing, supporting): Unit tests, TDD — what dev owns
   - Q2 (Business-facing, supporting): Functional tests, BDD/acceptance — what QA automates
   - Q3 (Business-facing, critiquing): Exploratory testing, UAT — what QA does manually
   - Q4 (Technology-facing, critiquing): Performance, security, load — what needs tooling
   Map each story to its primary quadrant(s).

6. TEST ESTIMATION: Per-story breakdown table:
   Story ID | Test Design (hrs) | Test Execution (hrs) | Automation (hrs) | Regression (hrs) | Total (hrs) | Assignee

7. RESOURCE ALLOCATION: Who does what based on team size. Table: Team Member | Primary Stories | Secondary/Backup | Regression Areas

8. REGRESSION SCOPE: Which existing areas need retesting and WHY (impacted by this sprint's changes). Table: Area | Reason for Regression | Tests | Est. Time | Priority

9. ENVIRONMENT & TEST DATA: Table: Environment | URL | Purpose | Data Requirements | Refresh Schedule

10. ENTRY CRITERIA: Code complete and merged, unit tests passing (>80% coverage on new code), build successfully deployed to QA, test data loaded, no open blockers

11. EXIT CRITERIA: All P0/P1 tests pass, no open Critical/High defects, regression pass rate ≥ 95%, code coverage ≥ 80% on new code, performance benchmarks met, sign-off obtained

12. DAILY SCHEDULE: Day-by-day plan:
    Day 1: Smoke test + test design + env verification
    Day 2-N: Test execution by priority (P0 first, then P1, etc.)
    Last 2 days: Regression + exploratory + sign-off preparation

13. DEPENDENCIES & BLOCKERS: External dependencies, environment dependencies, data dependencies

14. DEFINITION OF DONE (QA-specific): Checklist of what "done" means from QA perspective

15. MARKDOWN OUTPUT: Professional Confluence-ready markdown with all sections, tables, and [Company Name]/[Project Name] placeholders

Return ONLY valid JSON:
{
  "testPlan": {
    "sprintName": "Sprint name",
    "sprintDates": "Start — End date range",
    "version": "1.0",
    "author": "QA Lead",
    "approvalStatus": "Draft",
    "objective": "Sprint test objective tied to sprint goal",
    "estimatedHours": 0,
    "testEnvironments": ["QA", "Staging"]
  },
  "scope": {
    "inScope": [{ "storyId": "US-401", "title": "Story title", "acceptanceCriteria": ["AC-1: ...", "AC-2: ..."] }],
    "outOfScope": [{ "item": "What is excluded", "reason": "Why" }]
  },
  "riskMatrix": [
    { "riskId": "R-001", "description": "Risk description", "likelihood": 4, "impact": 5, "score": 20, "mitigation": "How to mitigate", "owner": "QA1" }
  ],
  "testingQuadrants": {
    "q1": { "label": "Unit/TDD (Dev-owned)", "items": ["Unit tests for auth module"] },
    "q2": { "label": "Functional/BDD (QA Automation)", "items": ["Automated acceptance tests for 2FA flow"] },
    "q3": { "label": "Exploratory/UAT (QA Manual)", "items": ["Exploratory testing of new UI flows"] },
    "q4": { "label": "Performance/Security (Tooling)", "items": ["Load test on login endpoint"] }
  },
  "estimation": [
    { "storyId": "US-401", "title": "Story", "testDesignHrs": 2, "testExecutionHrs": 4, "automationHrs": 3, "regressionHrs": 1, "totalHrs": 10, "assignee": "QA1" }
  ],
  "resourceAllocation": [
    { "member": "QA1", "primaryStories": ["US-401", "US-402"], "backup": ["US-403"], "regressionAreas": ["Authentication"] }
  ],
  "stories": [
    {
      "storyId": "US-401", "title": "Story title", "riskLevel": "high",
      "testCases": [{ "title": "Test case", "type": "functional", "priority": "P0", "estimatedMinutes": 30, "assignee": "QA1" }],
      "testDataNeeded": "What test data is required"
    }
  ],
  "regressionSuite": [{ "area": "Area name", "reason": "Why regression needed", "tests": 10, "estimatedMinutes": 60, "priority": "P1" }],
  "schedule": [{ "day": 1, "activities": ["Activity 1"], "milestone": "Milestone or empty string" }],
  "environmentAndData": [{ "environment": "QA", "url": "https://qa.app.com", "purpose": "Functional testing", "dataRequirements": "Seeded test users", "refreshSchedule": "Daily at 6 AM" }],
  "entryExitCriteria": {
    "entry": ["Code complete and merged to release branch", "Unit tests passing with >80% coverage on new code"],
    "exit": ["All P0/P1 tests pass", "No open Critical/High defects", "Regression pass rate >= 95%"]
  },
  "dependencies": [{ "dependency": "Description", "type": "external|environment|data|team", "status": "resolved|pending|blocked", "owner": "Who" }],
  "definitionOfDone": ["All acceptance criteria verified", "Regression suite passed", "No open P0/P1 defects"],
  "risks": [{ "risk": "Risk description", "mitigation": "How to mitigate", "probability": "low|medium|high" }],
  "markdownOutput": "Complete Confluence-ready markdown with all sections and tables"
}`;

  const response = await callAI(systemPrompt, `Sprint Information:\n${sprintInfo}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 11. AUTOMATION SCRIPT GENERATOR — Enterprise POM Architecture
// ═══════════════════════════════════════════════════════════════
export async function generateAutomationScript(scenario: string, framework: 'playwright' | 'cypress' | 'selenium-js' | 'puppeteer' | 'webdriverio', options: { language: 'typescript' | 'javascript'; includePageObject: boolean; includeHelpers: boolean; includeCIConfig: boolean }) {
  const frameworkRules: Record<string, string> = {
    playwright: `PLAYWRIGHT-SPECIFIC RULES:
- Use @playwright/test (NOT the legacy 'playwright' library)
- Locators: page.getByTestId() first, then page.getByRole(), page.getByText(), page.getByLabel(). NEVER use page.$() or fragile CSS nth-child selectors
- Waits: Rely on Playwright's auto-waiting. NEVER use page.waitForTimeout() with arbitrary ms
- Assertions: Use expect() from @playwright/test with .toBeVisible(), .toHaveText(), .toHaveURL(), etc.
- Config: Include playwright.config.ts with: parallel workers, retries: process.env.CI ? 2 : 0, trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'on-first-retry'
- Use test.describe() for grouping, test.beforeEach() for setup
- Use test.use({ storageState }) for auth state reuse`,
    cypress: `CYPRESS-SPECIFIC RULES:
- NEVER use async/await with cy. commands (Cypress is NOT promise-based)
- Use cy.intercept() for network stubbing (NOT cy.server() which is deprecated)
- Use cy.session() for auth state caching across tests
- Locators: cy.getByTestId() (via custom command) first, then cy.findByRole(), cy.contains()
- Waits: Use .should() assertions for retry-ability. NEVER use cy.wait(ms) with arbitrary delays
- Include cypress.config.ts and support/commands.ts with custom commands
- Use Cypress.env() for environment variables`,
    'selenium-js': `SELENIUM-JS RULES:
- Use selenium-webdriver with Builder pattern
- Use By.css('[data-testid="..."]') for locators. NEVER use fragile XPath
- Add explicit waits with driver.wait(until.elementLocated()) — NEVER use driver.sleep()
- Use Page Object Model with methods returning this for chaining`,
    puppeteer: `PUPPETEER RULES:
- Use page.waitForSelector() before interactions. NEVER use page.waitForTimeout()
- Use page.$eval() for assertions
- Use data-testid selectors via page.$('[data-testid="..."]')`,
    webdriverio: `WEBDRIVERIO RULES:
- Use $('[data-testid="..."]') locator strategy
- Use .waitForDisplayed() for waits. NEVER use browser.pause() with arbitrary ms
- Use Page Object pattern with get accessors for elements`,
  };

  const pomInstruction = options.includePageObject ? `
REQUIRED PROJECT STRUCTURE — generate ALL of these files:
tests/
├── pages/
│   ├── BasePage.ts       # Abstract base: navigation, waitForPageLoad, screenshot, common interactions
│   └── [Feature]Page.ts  # Feature page: locators as private getters, public action methods, JSDoc on every method
├── specs/
│   └── [feature].spec.ts # Test file: describe/it blocks, beforeEach/afterEach, independent tests
├── fixtures/
│   └── testData.ts       # Test data constants: valid/invalid/edge-case data objects
├── utils/
│   └── helpers.ts        # Auth helpers, custom expect wrappers, retry logic, date generators
└── config/
    └── ${framework === 'cypress' ? 'cypress' : 'playwright'}.config.ts  # Framework configuration

PAGE OBJECT RULES:
- BasePage: constructor takes page/driver, has methods: goto(path), waitForPageLoad(), takeScreenshot(name), getTitle()
- Feature pages extend BasePage
- Locators are PRIVATE getter properties (not public strings) — encapsulate the selectors
- Each action method has JSDoc explaining what it does, parameters, and return value
- Action methods return the page object (this) for chaining where appropriate
- NEVER expose raw selectors to test files — all interaction goes through page object methods` : 'Generate test code without Page Object Model — inline everything in the test file.';

  const ciInstruction = options.includeCIConfig ? `
INCLUDE CI/CD CONFIG:
- GitHub Actions YAML (.github/workflows/e2e.yml)
- Trigger on push and pull_request to main
- Install dependencies, install browsers (for Playwright), run tests
- Upload test results and artifacts (screenshots, videos, traces) on failure
- Matrix strategy for multiple browsers if applicable` : '';

  const helperInstruction = options.includeHelpers ? `
INCLUDE HELPER UTILITIES (tests/utils/helpers.ts):
- Auth helper: login function that returns auth token or sets storage state
- Custom assertion helpers: expectToastMessage(), expectFormError(), expectRedirectTo()
- Retry helper: retryAction(fn, maxRetries, delayMs) for flaky external service calls
- Data generator: randomEmail(), randomPassword(), futureDate(), pastDate()
- Environment config reader: getEnvVar(name, fallback)` : '';

  const systemPrompt = `You are a principal test automation architect at a Fortune 500 company. Generate production-ready, immediately-runnable automation projects.

Framework: ${framework}
Language: ${options.language}

${frameworkRules[framework] || ''}

ABSOLUTE CODE QUALITY RULES (enforce ALL):
1. LOCATORS: data-testid first → getByRole/getByText → aria-label → CSS. NEVER use nth-child, nth-of-type, or XPath
2. WAITS: Use auto-waiting or explicit conditions. NEVER use sleep()/waitForTimeout()/pause() with arbitrary ms delays
3. ASSERTIONS: Specific with custom error messages: expect(title).toBe('Dashboard', { message: 'User should see dashboard after login' })
4. INDEPENDENCE: Each test is independent — no shared state, no order dependency, no reliance on other test results
5. SETUP/TEARDOWN: beforeEach creates fresh state, afterEach cleans up (screenshots on failure, logout, etc.)
6. ENVIRONMENT: All URLs and credentials via environment variables or config — NEVER hardcoded. Use process.env.BASE_URL or Cypress.env()
7. IMPORTS: Every file has complete imports at the top. No missing dependencies.
8. JSDOC: Every page object method and test case has a JSDoc comment explaining what and why
9. RUNNABLE: Mentally verify the code runs after \`npm install && npx playwright install\` (or equivalent). No missing files, no undefined references.
10. NO DEPRECATED APIS: Use the latest stable API for ${framework}

${pomInstruction}

${helperInstruction}

${ciInstruction}

Return ONLY valid JSON:
{
  "framework": "${framework}",
  "language": "${options.language}",
  "projectStructure": "ASCII tree of the generated project structure",
  "files": [
    {
      "filename": "tests/pages/BasePage.ts",
      "description": "What this file does and its role in the architecture",
      "fileType": "page_object|spec|fixture|helper|config|ci",
      "code": "// Complete, runnable file content with JSDoc comments"
    }
  ],
  "packageJson": {
    "scripts": { "test": "...", "test:headed": "...", "test:debug": "..." },
    "devDependencies": { "${framework === 'cypress' ? 'cypress' : '@playwright/test'}": "^latest" }
  },
  "setupInstructions": ["npm install", "npx playwright install (if Playwright)"],
  "runCommand": "npx playwright test",
  "debugCommand": "npx playwright test --debug"
}`;

  const response = await callAI(systemPrompt, `Test Scenario to Automate:\n${scenario}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 12. COVERAGE EXPANDER — Enterprise Coverage Analysis
// ═══════════════════════════════════════════════════════════════
export async function expandCoverage(existingTests: string, expansionType: 'edge_cases' | 'negative' | 'security' | 'performance' | 'accessibility' | 'all') {
  const focusAreas = expansionType === 'all'
    ? 'ALL areas: edge cases, negative testing, security, performance, accessibility, requirements coverage, test design technique coverage'
    : expansionType;

  const systemPrompt = `You are a principal QA coverage analyst at a Fortune 500 company. Analyze existing test cases and produce an enterprise-grade coverage expansion report.

Expansion focus: ${focusAreas}

ANALYSIS REQUIREMENTS — perform ALL of these gap analyses:

1. REQUIREMENTS COVERAGE: Infer acceptance criteria from the test names. Which criteria likely exist but lack test cases?
2. TEST DESIGN TECHNIQUE COVERAGE: Which techniques are missing?
   - BVA (Boundary Value Analysis): Are min/max/boundary values tested?
   - EP (Equivalence Partitioning): Are valid/invalid input classes covered?
   - Decision Table: Are all condition combinations tested?
   - State Transition: Are all state changes tested (e.g., logged out → logged in → session expired)?
   - Error Guessing: Are common failure modes tested?
3. RISK COVERAGE: Which high-risk areas have insufficient testing?
4. NEGATIVE TESTING COVERAGE: What error conditions, invalid inputs, and failure modes aren't tested?
5. NON-FUNCTIONAL COVERAGE: Performance, security, accessibility, usability gaps

COVERAGE METRICS — calculate and report:
- Current estimated coverage score (%) with breakdown: requirements %, positive path %, negative %, edge case %, security %, performance %, accessibility %
- Projected coverage after adding recommended tests
- Coverage by module/feature — heat map table: Module, Current %, Projected %, Gap Count, Risk Level

NEW TEST CASES — each must include:
- Which specific gap it closes (reference the gap ID)
- Which test design technique it uses (BVA/EP/DT/ST/EG — label explicitly)
- Risk priority with justification (why this priority, not arbitrary)
- Estimated coverage improvement for this specific test
- Effort estimate (minutes to write + execute)

PRIORITIZATION: Order new tests by coverage gain per effort — highest impact first.

Return ONLY valid JSON:
{
  "analysis": {
    "existingCoverage": "Detailed description of what current tests cover well",
    "coverageBreakdown": {
      "requirements": 0,
      "positivePath": 0,
      "negative": 0,
      "edgeCase": 0,
      "security": 0,
      "performance": 0,
      "accessibility": 0
    },
    "currentScore": 0,
    "projectedScore": 0,
    "gaps": ["Gap 1 description"]
  },
  "gapAnalysis": [
    {
      "gapId": "GAP-001",
      "category": "requirements|technique|risk|negative|non_functional",
      "description": "Specific gap description",
      "riskLevel": "High|Medium|Low",
      "affectedArea": "Module or feature affected",
      "missingTechnique": "BVA|EP|DT|ST|EG|N/A",
      "impact": "What could go wrong if this gap remains"
    }
  ],
  "coverageHeatMap": [
    { "module": "Module name", "currentCoverage": 0, "projectedCoverage": 0, "gapCount": 0, "riskLevel": "High|Medium|Low" }
  ],
  "newTestCases": [
    {
      "category": "edge_case|negative|security|performance|accessibility|functional",
      "title": "Specific test title",
      "description": "What this test verifies and why it matters",
      "closesGap": "GAP-001",
      "testDesignTechnique": "BVA|EP|DT|ST|EG",
      "steps": ["Specific step 1", "Specific step 2"],
      "expectedResult": "Specific expected outcome",
      "priority": "P0|P1|P2|P3",
      "priorityJustification": "Why this priority — tied to risk",
      "coverageImprovement": "+3%",
      "effortMinutes": 30,
      "whyNeeded": "What specific bug could reach production without this test"
    }
  ],
  "prioritizedOrder": ["TC-ID-1 (+5%, 20min)", "TC-ID-2 (+3%, 15min)"],
  "resourceEstimate": {
    "totalNewTests": 0,
    "totalDesignHours": 0,
    "totalExecutionHours": 0,
    "totalAutomationHours": 0
  },
  "coverageImprovement": "+X%",
  "executiveSummary": "2-3 sentence summary: current state, key gaps, projected improvement, recommended priority"
}`;

  const response = await callAI(systemPrompt, `Existing Test Cases:\n${existingTests}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 13. QA DOCUMENTATION GENERATOR
// ═══════════════════════════════════════════════════════════════

type QADocType = 'test_strategy' | 'test_summary' | 'traceability_matrix' | 'test_closure' | 'defect_report' | 'test_environment' | 'qa_checklist' | 'test_execution_report' | 'uat_signoff' | 'risk_assessment';

function getDocTypePrompt(docType: QADocType, dateStr: string): string {
  const docTypeLabel = docType.replace(/_/g, ' ').toUpperCase();

  const header = `CRITICAL INSTRUCTION: Generate ONLY a ${docTypeLabel} document. Do NOT generate a test strategy. Do NOT default to test strategy structure. The output structure MUST match the specific template described below — every section listed below MUST appear in your output. If you generate a test strategy when a different document type was requested, the output is WRONG.

Use [Company Name] and [Project Name] as placeholders the user can replace.
Include a Version History table at the very top of the markdown (columns: Version, Date, Author, Change Description).
Include a Document Approval / Sign-off section at the bottom (table: Role, Name, Signature, Date).
Use professional markdown tables throughout. The markdownOutput must be copy-paste ready for Confluence or Google Docs.
Date for document: ${dateStr}`;

  const prompts: Record<QADocType, string> = {
    test_strategy: `You are a QA Director at a Fortune 500 company creating a TEST STRATEGY DOCUMENT.

${header}

REQUIRED SECTIONS — generate ALL of these with realistic, detailed content:
1. Executive Summary — high-level purpose, project context, strategic testing goals
2. Testing Objectives — SMART objectives tied to business outcomes
3. Scope — In-Scope items table (module, test types, priority) and Out-of-Scope items with justification
4. Test Levels Matrix — table: Test Level (Unit, Component, Integration, System, UAT), Description, Owner, Entry Criteria, Exit Criteria, Tools
5. Test Types — Functional, Non-Functional (Performance, Security, Accessibility, Usability, Compatibility), Regression, Smoke, Sanity — each with description and when applied
6. Automation Strategy — tool selection rationale, scope of automation, ROI targets, automation vs manual split, framework architecture
7. Tools & Infrastructure — table: Tool, Purpose, License, Owner
8. Test Environment Strategy — table: Environment (Dev, QA, Staging, Pre-Prod, Prod), Purpose, Refresh Cycle, Data Strategy, Access
9. Test Data Strategy — how test data is generated, masked, refreshed, managed across environments
10. Defect Management — lifecycle (New → Assigned → In Progress → Fixed → Verified → Closed / Reopened), severity definitions with examples, triage SLA by severity, escalation path
11. RACI Matrix — table: Activity vs Roles (QA Lead, QA Engineer, Dev Lead, Developer, PM, BA) with R/A/C/I designations
12. Risk Register — table: Risk ID, Risk Description, Probability (H/M/L), Impact (H/M/L), Risk Score, Mitigation Strategy, Owner
13. Metrics & KPIs — what quality metrics will be tracked, targets, reporting cadence
14. Schedule & Milestones — Gantt-style table: Phase, Start, End, Deliverable, Owner
15. Entry/Exit Criteria per Test Level — table format
16. Sign-off Section`,

    test_summary: `You are a QA Lead at a Fortune 500 company creating a TEST SUMMARY REPORT. This is a POST-TESTING document about what HAPPENED, not a plan for what WILL happen.

${header}

THIS IS NOT A TEST STRATEGY. This document reports on testing that was COMPLETED. Use past tense. Include actual metrics and results.

REQUIRED SECTIONS — generate ALL with realistic metrics:
1. Report Identifier — report ID, release name, version, sprint number, date range, prepared by
2. Executive Summary — 2-3 paragraph overview of testing outcomes, key findings, and recommendation
3. Test Objective vs Achievement — table: Objective, Target, Actual, Status (Met/Missed/Partial)
4. Test Execution Summary TABLE — columns: Test Type (Smoke, Functional, Integration, Regression, E2E, Performance), Planned, Executed, Passed, Failed, Blocked, Skipped, Pass Rate %
5. Defect Summary by Severity — table: Severity (Critical/High/Medium/Low/Info), Found, Fixed, Open, Deferred, Reopened, % of Total
6. Defect Summary by Status — table: Status (Open/In Progress/Fixed/Verified/Closed/Deferred), Count, %
7. Defect Summary by Module — table: Module, Total Defects, Critical, High, Medium, Low, Defect Density
8. Defect Trends — table by week/sprint: Period, Found, Resolved, Cumulative Open (describe trend line)
9. Test Coverage by Module — table: Module, Requirements, Test Cases, Executed, Coverage %
10. Environment Details — table: Environment, URL, Version Deployed, Database Version, Notes
11. Deviations from Test Plan — what changed from original plan and why
12. Open Defects with Risk Assessment — table: Defect ID, Title, Severity, User Impact, Risk if Released, Workaround (Y/N), Recommendation
13. Key Metrics Dashboard:
    - Test Case Pass Rate = (Passed / Executed) × 100
    - Defect Density = Total Defects / Modules (or KLOC)
    - Defect Removal Efficiency (DRE) = (Defects found in testing / Total defects including production) × 100
    - Defect Leakage Rate = (Production defects / Total defects) × 100
    - Test Execution Rate = Tests executed per day
14. Remaining Risks — table: Risk, Likelihood, Impact, Mitigation
15. Lessons Learned — What went well, What didn't, Action items for next cycle
16. Go/No-Go Recommendation — EXPLICIT recommendation (GO / NO-GO / CONDITIONAL) with evidence table: Criterion, Target, Actual, Met?`,

    traceability_matrix: `You are a QA Manager creating a REQUIREMENTS TRACEABILITY MATRIX (RTM). This document is TABLE-HEAVY — it's primarily tables, not prose.

${header}

THIS IS NOT A TEST STRATEGY. This is a TRACEABILITY document that maps requirements to test cases. It should be 80% tables.

REQUIRED SECTIONS — generate ALL. The tables must have realistic sample data (10+ rows each):
1. Forward Traceability Table — columns: Requirement ID, Requirement Description, Priority (P0-P4), Test Case ID(s), Test Status (Pass/Fail/Not Run), Defect ID(s), Coverage Status (Covered/Partial/Not Covered). Generate at least 10 rows with realistic data.
2. Backward Traceability Table — columns: Test Case ID, Test Case Title, Requirement ID(s) Covered, Execution Status, Last Run Date. Include orphan tests that map to no requirement.
3. Coverage Heat Map by Module — table: Module, Total Requirements, Covered, Partial, Not Covered, Coverage %, RAG Status (Red <50%/Amber 50-80%/Green >80%)
4. Gap Analysis — Requirements with NO test coverage. Table: Requirement ID, Description, Priority, Risk if Untested, Recommended Action
5. Orphaned Test Cases — Test cases NOT linked to any requirement. Table: Test Case ID, Title, Recommendation (Keep/Retire/Reassign to requirement)
6. Coverage Summary — Overall coverage %, Coverage by priority (P0: %, P1: %, P2: %, P3: %), Coverage trend vs previous release
7. Coverage Improvement Plan — table: Action, Priority, Owner, Target Date, Expected Coverage Improvement`,

    test_closure: `You are a QA Director creating a TEST CLOSURE REPORT for executive sign-off. This is a FORMAL document that closes testing activities.

${header}

THIS IS NOT A TEST STRATEGY. This document CLOSES testing — it reports final results and obtains sign-off. Use past tense.

REQUIRED SECTIONS — generate ALL:
1. Project Summary — project name, release version, test period dates, QA team size, total effort (person-days)
2. Objectives vs Achievements — table: Objective, Target, Actual, Status (Met/Partially Met/Not Met). At least 6 rows.
3. Quality KPIs — table: KPI, Target, Actual, Status, Trend
   - Defect Density (defects per feature or per KLOC)
   - Defect Removal Efficiency (DRE) = defects found in testing / (testing + production defects)
   - Test Coverage % by requirements AND by code
   - Defect Leakage Rate = production defects / total defects × 100
   - Test Automation Rate = automated tests / total tests × 100
4. Test Execution Results — table: Test Type, Total, Executed, Passed, Failed, Blocked, Pass Rate %
5. Defect Analysis — two tables:
   a. By Severity: Severity, Found, Fixed, Deferred, Open, Reopened
   b. By Priority: Priority, Found, Fixed, Deferred, Open, Reopened
6. Pending Risks — table: Risk ID, Description, Severity, Mitigation, Owner, Resolution Timeline
7. Lessons Learned — categorized sections: Process improvements, Tool improvements, People/skills, Technical debt identified
8. Recommendations for Next Release — numbered, prioritized list with expected impact
9. Formal Sign-off — table: Role (QA Lead, Dev Lead, PM, Product Owner, VP Engineering), Name, Decision (Approve/Reject/Conditional), Conditions, Date`,

    defect_report: `You are a QA Analytics Lead creating a DEFECT ANALYSIS REPORT. This is a DATA-HEAVY analytical document focused entirely on defect metrics.

${header}

THIS IS NOT A TEST STRATEGY. This document analyzes DEFECTS — their distribution, trends, root causes, and prevention. It should be 70% tables and metrics.

REQUIRED SECTIONS — generate ALL with realistic sample data:
1. Defect Distribution by Severity — table: Severity, Count, % of Total, Trend vs Last Release (↑/↓/→)
2. Defect Distribution by Priority — table: Priority (P0-P4), Count, % of Total
3. Defect Distribution by Module — table: Module, Total, Critical, High, Medium, Low, % of Total. At least 6 modules.
4. Defect Distribution by Sprint — table: Sprint, Found, Fixed, Reopened, Net Open. At least 4 sprints.
5. Defect Discovery vs Resolution Rate — table by week/sprint: Period, Found, Resolved, Cumulative Open. Describe the trend (converging = good, diverging = bad).
6. Mean Time to Resolution — table: Severity, Avg Hours to Fix, Min Hours, Max Hours, SLA Target, SLA Met %
7. Root Cause Categorization — table: Root Cause Category (Coding Error, Requirement Gap, Requirement Misunderstanding, Environment Issue, Test Data Problem, Design Flaw, Configuration Error, Third-Party Dependency), Count, %, Prevention Action. Include percentages.
8. Defect Injection Point Analysis — table: SDLC Phase Introduced (Requirements, Design, Coding, Integration, Deployment), Count, %, Relative Cost to Fix (1x/5x/10x/50x/100x per Boehm's curve)
9. Defect Age Analysis — table: Age Bucket (0-1 days, 2-3 days, 4-7 days, 1-2 weeks, 2-4 weeks, 4+ weeks), Open Count, Resolved Count, % of Total
10. Pareto Analysis — identify which 20% of modules cause 80% of bugs. Table: Module, Defect Count, Cumulative %, Pareto Category (Top 20% / Remaining 80%)
11. Sprint-over-Sprint Trend Comparison — table: Metric (Total Found, Total Fixed, DRE, MTTR, Defect Density), Sprint N-2, Sprint N-1, Sprint N, Trend
12. Prevention Recommendations — numbered list: Recommendation, Expected Impact, Priority, Owner`,

    test_environment: `You are a DevOps/QA Infrastructure Lead creating a TEST ENVIRONMENT SETUP DOCUMENT. This is a TECHNICAL OPERATIONS document.

${header}

THIS IS NOT A TEST STRATEGY. This document describes HOW to set up and maintain test environments. It should include actual commands, versions, and configuration details.

REQUIRED SECTIONS — generate ALL:
1. Environment Architecture Overview — text description of environment topology (tiers, load balancers, microservices, container orchestration)
2. Hardware/VM Specifications — table: Component (App Server, DB Server, Cache, Queue, CDN), CPU, RAM, Storage, OS, Purpose
3. Software Stack — table: Software, EXACT Version, Purpose, License Type, Installation Command/Notes. Include specific versions (e.g., Node.js 20.11.0, PostgreSQL 16.2).
4. Network Configuration — VPN requirements, firewall rules table (Port, Protocol, Source, Destination, Purpose), DNS entries
5. Database Setup — table: Database Name, Engine/Version, Size, Refresh Source, Refresh Schedule, Test Data Seeding Method
6. Third-Party Service Configurations — table: Service, Purpose, Endpoint URL, Auth Method, Mock Available (Y/N), Rate Limits, Sandbox/Prod
7. Access Credentials Template — table: System, URL, Username Template, Default Role, Access Request Process. NO real passwords.
8. Environment URLs — table: Environment (Dev, QA, Staging, Pre-Prod, Prod), App URL, API URL, Admin Panel URL, Monitoring Dashboard URL
9. Setup Steps with Commands — numbered steps with actual CLI commands (git clone, docker-compose up, npm install, database migrations, seed scripts)
10. Health Check Verification — table: Check Name, Command or URL, Expected Result, Timeout
11. Known Differences from Production — table: Aspect (Scale, Data Volume, External Services, Auth), Production Config, Test Config, Impact on Testing
12. Troubleshooting Guide — table: Symptom, Likely Cause, Resolution Steps, Escalation Contact
13. Environment Refresh/Reset Procedures — step-by-step for each environment type (full reset, data-only refresh, config-only update)`,

    qa_checklist: `You are a QA Process Lead creating a QA PROCESS CHECKLIST document. This is a CHECKLIST document — it should use checkbox format throughout.

${header}

THIS IS NOT A TEST STRATEGY. This document contains CHECKLISTS with checkboxes (use ☐ in markdown). Each checklist item must have: #, Checklist Item, Responsible Role, Status (☐/☑), Notes column.

Generate SIX distinct checklists:

1. Sprint QA Checklist — three sub-sections:
   a. Pre-Sprint (8-10 items): requirements reviewed with AC, test environment reserved, test data prepared, automation framework updated, capacity planned, risks identified, dependency matrix reviewed
   b. During Sprint (8-10 items): daily smoke tests run, test execution tracked in tool, defect triage attended, daily standup reported, blocker escalation within 2h, test progress dashboard updated, exploratory sessions completed
   c. End of Sprint (8-10 items): full regression executed, test summary report generated, defect backlog groomed, sprint retrospective QA input, knowledge base updated, automation added for new features, metrics reported

2. Release Checklist — four sub-sections:
   a. Pre-Deploy (8-10 items): all test suites green, go/no-go meeting completed, release notes reviewed and approved, rollback plan documented and tested, monitoring alerts configured, on-call schedule confirmed
   b. Deploy (6-8 items): deployment steps executed per runbook, smoke tests in target environment, health checks all passing, performance baseline captured, cache invalidation verified
   c. Post-Deploy (6-8 items): production verification tests executed, user-facing critical paths validated, error rate monitoring (first 24h), stakeholder notification sent, support team briefed
   d. Rollback (5-6 items): rollback criteria clearly defined, rollback procedure tested in staging, data migration reversibility confirmed, communication plan for rollback ready

3. Requirement Review Checklist (8-10 items): testability verified, acceptance criteria clear and measurable, edge cases identified, dependencies mapped, non-functional requirements specified, data requirements defined

4. Test Readiness Checklist (8-10 items): test plan approved by stakeholders, test cases peer-reviewed, test data created and verified, test environment stable for 24h, automation scripts tested, entry criteria met, test schedule confirmed

5. UAT Sign-off Checklist (8-10 items): all UAT scenarios executed, business process validations complete, user feedback collected and addressed, training materials prepared, sign-off forms distributed, outstanding issues documented with risk acceptance

6. Production Verification Checklist (8-10 items): critical user journeys verified, API integrations validated end-to-end, performance within SLA, security scan clear, monitoring dashboards green, logging verified, alerting tested`,

    test_execution_report: `You are a QA Lead creating a TEST EXECUTION REPORT for a specific sprint or release cycle. This is a RESULTS document about testing that was PERFORMED.

${header}

THIS IS NOT A TEST STRATEGY. This reports on test EXECUTION that already happened. Use past tense. Include specific numbers and results.

REQUIRED SECTIONS — generate ALL with realistic data:
1. Execution Overview — sprint/release name, execution period, QA team members involved, environment(s) used, build version tested
2. Test Execution Summary — table: Test Suite (Smoke, Functional, Integration, Regression, E2E, Performance), Total Cases, Executed, Passed, Failed, Blocked, Skipped, Pass Rate %
3. Daily Execution Progress — table: Date (Day 1 through last day), Planned Tests, Executed, Cumulative %, Blockers/Notes
4. Failed Test Cases Detail — table: Test ID, Title, Module, Failure Reason (specific), Linked Defect ID, Defect Severity, Retest Status (Retested-Pass/Retested-Fail/Pending)
5. Blocked Test Cases Detail — table: Test ID, Title, Blocker Description, Blocked Since (date), Dependency, Resolution ETA, Impact
6. Automation Execution Results — table: Suite Name, Total Tests, Passed, Failed, Flaky (passed on retry), Execution Time, Last Run Timestamp
7. Defects Raised This Cycle — table: Defect ID, Title, Severity, Priority, Module, Current Status, Assigned To
8. Test Environment Issues — table: Issue, Date, Duration, Impact on Testing (tests blocked/delayed), Resolution
9. Execution Metrics — calculated values: Test Execution Rate (tests/day), Defect Detection Rate (defects/tests executed), Automation Coverage (auto tests/total tests), Manual Effort (hours)
10. Risks & Recommendations — testing risks identified, schedule impact assessment, recommendations for next cycle`,

    uat_signoff: `You are a Business Analyst / QA Lead creating a UAT SIGN-OFF DOCUMENT for formal user acceptance. This is a BUSINESS document for stakeholder sign-off.

${header}

THIS IS NOT A TEST STRATEGY. This is a formal UAT acceptance document written for BUSINESS stakeholders, not technical teams. Use business language.

REQUIRED SECTIONS — generate ALL:
1. UAT Overview — purpose of UAT, scope (features/modules), participants table (Name, Role, Department), UAT period, success criteria (quantified: e.g., "95% of critical scenarios pass")
2. Business Scenarios Tested — table: Scenario ID, Business Process, Description, Priority (Critical/High/Medium), Status (Pass/Fail/Partial), Tested By, Notes
3. UAT Test Results Summary — table: Module/Feature, Total Scenarios, Passed, Failed, Blocked, Acceptance Rate %
4. Defects Found During UAT — table: Defect ID, Description, Severity, Business Impact Description, Resolution Status, Accepted for Release (Yes/No/Conditional), Risk if Released
5. Deferred Items — table: Item, Reason for Deferral, Business Impact, Target Release, Stakeholder Approval
6. User Feedback Summary — categorized: Positive Feedback, Improvement Suggestions, Concerns Raised, Action Items
7. Training & Documentation Readiness — table: Item (User Guide, FAQ, Training Session, Release Notes, Support Runbook), Status (Ready/In Progress/Not Started), Owner, Target Date
8. Go-Live Readiness Checklist — table: Criteria, Status (Ready/Not Ready), Evidence/Link, Owner
9. Formal Acceptance Decision — clearly stated: ACCEPT / CONDITIONAL ACCEPT (list conditions) / REJECT (list reasons)
10. Business Sign-off Table — table: Stakeholder Name, Role/Title, Department, Decision (Accept/Reject/Conditional), Conditions (if any), Signature, Date`,

    risk_assessment: `You are a QA Risk Manager creating a RISK ASSESSMENT MATRIX for testing activities. This is a RISK-FOCUSED document.

${header}

THIS IS NOT A TEST STRATEGY. This document identifies, scores, and plans mitigation for TESTING RISKS. It's primarily a risk register with analysis.

REQUIRED SECTIONS — generate ALL:
1. Risk Assessment Overview — methodology (Probability × Impact = Risk Score), risk appetite definition, assessment scope, risk tolerance thresholds
2. Risk Scoring Matrix — 5×5 grid description: Probability (1-Very Low to 5-Very High) × Impact (1-Negligible to 5-Critical). Define zones: Green (1-4), Yellow (5-9), Orange (10-14), Red (15-25)
3. Risk Register — MAIN TABLE with columns: Risk ID, Category, Risk Description, Probability (1-5), Impact (1-5), Risk Score, Priority (Critical/High/Medium/Low), Mitigation Strategy, Contingency Plan, Owner, Status (Open/Mitigating/Accepted/Closed), Review Date. Generate at least 10 risks.
4. Risk Categories with specific risks for each:
   a. Testing Risks (3-4 items) — insufficient test coverage, flaky automation, inadequate regression
   b. Technical Risks (3-4 items) — system complexity, integration failures, new technology, performance degradation
   c. Resource Risks (2-3 items) — skill gaps, availability, single points of knowledge failure
   d. Schedule Risks (2-3 items) — compressed timelines, late code delivery, environment downtime
   e. Environment Risks (2-3 items) — environment instability, data refresh failures, config drift from production
5. Risk Heat Map Summary — table: Risk Level (Critical/High/Medium/Low), Count, Top Risk in Category, Immediate Action Required (Y/N)
6. Mitigation Plan Timeline — table: Risk ID, Mitigation Action, Start Date, Target Completion, Owner, Current Status, % Complete
7. Risk Monitoring & Review Process — review cadence (weekly/biweekly), escalation criteria, risk register update process, RACI for risk management
8. Residual Risk Summary — table: Risk ID, Original Score, Mitigation Applied, Residual Score, Accepted By, Justification for Acceptance`,
  };

  return prompts[docType] ?? prompts.test_strategy;
}

export async function generateQADocumentation(input: string, docType: QADocType) {
  const dateStr = new Date().toISOString().split('T')[0];
  const docTypeLabel = docType.replace(/_/g, ' ');
  const docTypeTitleCase = docTypeLabel.replace(/\b\w/g, (c) => c.toUpperCase());

  const systemPrompt = `${getDocTypePrompt(docType, dateStr)}

REMEMBER: You are generating a ${docTypeTitleCase} — NOT a test strategy. The title must say "${docTypeTitleCase}". The content must match the template above.

Return ONLY valid JSON in this exact structure:
{
  "document": {
    "title": "${docTypeTitleCase} — [Project Name]",
    "type": "${docType}",
    "version": "1.0",
    "author": "QA Team",
    "date": "${dateStr}",
    "status": "Draft"
  },
  "sections": [
    {
      "heading": "Section heading matching the template above",
      "content": "Detailed section content",
      "subsections": [
        { "heading": "Subsection heading", "content": "Detailed content" }
      ]
    }
  ],
  "tables": [
    {
      "title": "Table title",
      "headers": ["Col1", "Col2", "Col3"],
      "rows": [["val1", "val2", "val3"]]
    }
  ],
  "markdownOutput": "The COMPLETE ${docTypeTitleCase} document in professional markdown format with ALL sections and tables rendered as markdown. Include the version history table at the top and sign-off table at the bottom. This must be copy-paste ready for Confluence.",
  "summary": "One-line summary of this ${docTypeLabel}"
}

FINAL CHECKS before responding:
1. Does the title say "${docTypeTitleCase}"? If not, fix it.
2. Does the content match the specific template for ${docType}? If it looks like a test strategy, REDO it.
3. Are ALL sections from the template above present? If any are missing, add them.
4. Are tables populated with realistic sample data? If empty, fill them.
5. Is the markdownOutput a COMPLETE document, not a summary? If it's abbreviated, expand it.
- Use professional formatting: numbered sections, proper markdown tables, clear headers.`;

  const response = await callAI(systemPrompt, `Project/Context Information:\n${input}\n\nDocument Type Requested: ${docTypeLabel}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 14. QA CHAT ASSISTANT (existing, enhanced)
// ═══════════════════════════════════════════════════════════════
export async function chatAboutBug(bugContext: string, messages: { role: string; content: string }[], userMessage: string) {
  const systemPrompt = `You are BugSense AI, a senior QA assistant. You help engineers understand bugs, write tests, debug issues, and improve quality processes.

Context: ${bugContext}

You can help with:
- Root cause analysis and debugging strategies
- Test case suggestions and coverage analysis
- Automation script recommendations
- Best practices for QA workflows
- Sprint testing strategies
- Performance and security testing advice

Be concise, technical, and actionable. Use code examples when relevant.`;

  if (!AI_API_KEY) {
    return getMockChatResponse(userMessage);
  }

  const allMessages = [
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const apiUrl = IS_NVIDIA
    ? 'https://integrate.api.nvidia.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (IS_NVIDIA) {
    headers['Authorization'] = `Bearer ${AI_API_KEY}`;
  } else {
    headers['x-api-key'] = AI_API_KEY;
    headers['anthropic-version'] = '2023-06-01';
  }

  const chatBody = IS_NVIDIA
    ? JSON.stringify({
        model: AI_MODEL,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          ...allMessages,
        ],
      })
    : JSON.stringify({
        model: AI_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: allMessages,
      });

  const response = await fetch(apiUrl, { method: 'POST', headers, body: chatBody });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);

  if (IS_NVIDIA) {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    const data: AIResponse = await response.json();
    return data.content.map((c) => c.text).join('');
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FORMATTERS
// ═══════════════════════════════════════════════════════════════
export function formatForJira(bug: Record<string, unknown>) {
  return {
    fields: {
      summary: bug.title,
      description: `h2. Description\n${bug.description}\n\nh2. Steps to Reproduce\n${(bug.stepsToReproduce as string[])?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\nh2. Expected Result\n${bug.expectedResult}\n\nh2. Actual Result\n${bug.actualResult}\n\nh2. Root Cause Hypotheses\n${(bug.rootCauseHypotheses as string[])?.map((h: string) => `* ${h}`).join('\n')}`,
      labels: bug.tags || [],
    },
  };
}

export function formatForGitHub(bug: Record<string, unknown>) {
  return {
    title: bug.title,
    body: `## Description\n${bug.description}\n\n## Steps to Reproduce\n${(bug.stepsToReproduce as string[])?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\n## Expected: ${bug.expectedResult}\n\n## Actual: ${bug.actualResult}\n\n## Severity: ${bug.severity} | Priority: ${bug.priority}\n\n---\n*Generated by BugSense AI*`,
    labels: [...((bug.tags as string[]) || []), `severity:${(bug.severity as string)?.toLowerCase()}`],
  };
}

// ═══════════════════════════════════════════════════════════════
// MOCK RESPONSES (Demo Mode)
// ═══════════════════════════════════════════════════════════════
function getMockResponse(systemPrompt: string, _userMessage: string): string {
  if (systemPrompt.includes('principal QA quality auditor') || systemPrompt.includes('quality evaluator')) {
    return JSON.stringify({
      score: 72,
      rating: 'Literalist',
      breakdown: {
        identification: { score: 7, max: 10, percentage: 70, details: 'Good title with component name. Missing app version/build number and regression flag.' },
        classification: { score: 11, max: 15, percentage: 73, details: 'Severity and priority present with some justification. Missing root cause category and impact radius quantification.' },
        reproduction: { score: 22, max: 30, percentage: 73, details: 'Numbered steps from a clear starting state. Missing exact input values (says "valid credentials" instead of specific email/password). No reproducibility rate stated.' },
        environment: { score: 9, max: 15, percentage: 60, details: 'OS and browser mentioned. Missing exact versions, no test data values, no network conditions.' },
        evidence: { score: 8, max: 15, percentage: 53, details: 'Error message included in actual result. No screenshots, no logs, no stack trace, no HAR file.' },
        analysis: { score: 15, max: 15, percentage: 100, details: 'Excellent root cause hypothesis with confidence levels. Workaround documented. Business impact quantified with user segment and revenue impact.' },
      },
      suggestions: [
        { dimension: 'environment', priority: 'High', suggestion: 'Include exact browser version (e.g., "Chrome 120.0.6099.130") instead of just "Chrome". Add OS version (e.g., "Windows 11 23H2" not just "Windows").', impact: '+3 points' },
        { dimension: 'reproduction', priority: 'High', suggestion: 'Replace "enter valid credentials" with specific test values: email "qa.tester@company.com", password "TestPass123!". Add reproducibility rate: "Reproduces 5/5 attempts on Chrome, 0/5 on Firefox".', impact: '+5 points' },
        { dimension: 'evidence', priority: 'Medium', suggestion: 'Attach an annotated screenshot showing the error state. Include the browser console output (right-click → Inspect → Console tab). If a stack trace is visible, copy it verbatim.', impact: '+5 points' },
        { dimension: 'identification', priority: 'Low', suggestion: 'Add the app version or build number (e.g., "v2.4.1, build #1847"). Add a regression flag: "Regression: Yes — worked in v2.3.x, broken since v2.4.0".', impact: '+3 points' },
      ],
      strengths: [
        'Root cause analysis is exceptional — multiple hypotheses with confidence levels',
        'Business impact is well quantified with specific user segment and revenue figures',
        'Steps to reproduce are numbered and sequential (not a paragraph)',
      ],
      summary: 'Adequate report with strong analysis section but missing specific reproduction values, exact environment versions, and supporting evidence (screenshots/logs). Adding these would elevate it to Completionist level.',
    });
  }
  if (systemPrompt.includes('principal QA engineer performing enterprise-grade duplicate') || systemPrompt.includes('duplicate bug detector')) {
    return JSON.stringify({
      duplicates: [],
      clusters: [],
      summary: { totalCandidates: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 },
    });
  }
  if (systemPrompt.includes('test engineer') || systemPrompt.includes('regression test cases')) {
    return JSON.stringify({ testCases: [
      { title: 'Verify fix resolves reported issue', description: 'Confirm the primary bug is fixed', steps: ['Navigate to affected page', 'Perform triggering action', 'Verify correct behavior'], expectedResult: 'Feature works without error', type: 'regression', priority: 'P1' },
      { title: 'Edge case: rapid repeated actions', description: 'Test for race conditions', steps: ['Navigate to affected area', 'Rapidly perform triggering action', 'Check for errors'], expectedResult: 'System handles rapid input gracefully', type: 'edge_case', priority: 'P2' },
    ]});
  }
  if (systemPrompt.includes('reproduction checklist')) {
    return JSON.stringify({ checklist: ['Clear browser cache', 'Use incognito window', 'Verify correct environment', 'Check network', 'Document timestamps'], scenarios: [{ name: 'Standard reproduction', steps: ['Follow reported steps exactly', 'Note deviations', 'Capture screenshots'], expectedOutcome: 'Bug should be reproducible' }] });
  }
  if (systemPrompt.includes('principal QA architect') || systemPrompt.includes('comprehensive test cases from user stories')) {
    return JSON.stringify({
      testSuite: { title: 'Password Reset Test Suite', description: 'IEEE 829 compliant test cases for password reset flow. Traces to acceptance criteria AC-1 through AC-5.', totalCases: 4, coverageScore: 82 },
      testCases: [
        {
          id: 'TC-AUTH-001', category: 'positive', traceability: 'Covers AC-1: User clicks Forgot Password on login page',
          title: 'Successful password reset request with valid registered email',
          description: 'Verifies the complete happy path: user requests reset, receives email, clicks link, sets new password, and can log in with it.',
          preconditions: ["User 'john.doe@company.com' exists with role 'Standard User', has verified email, is NOT currently authenticated, is on the /login page"],
          steps: [
            { action: "Click the 'Forgot Password?' link located below the Password input field", testData: 'N/A', expected: "Browser navigates to /forgot-password. Page displays 'Reset your password' heading and an Email input field" },
            { action: "Type email address in the 'Email' input field", testData: 'john.doe@company.com', expected: "Email field displays typed value. 'Send Reset Link' button is enabled" },
            { action: "Click the 'Send Reset Link' button", testData: 'N/A', expected: "Success toast: 'Reset link sent to john.doe@company.com'. Button shows loading state for 1-2s. Email arrives within 30 seconds" },
            { action: 'Open reset email and click the reset link', testData: 'N/A', expected: "Browser opens /reset-password?token=<valid_token>. Page shows 'New Password' and 'Confirm Password' fields" },
            { action: "Enter new password in both fields and click 'Reset Password'", testData: 'NewSecure!Pass99', expected: "Success page: 'Password updated'. Redirect to /login within 3 seconds" },
          ],
          testDataTable: [
            { field: 'Email', validValue: 'john.doe@company.com', invalidValue: 'not-an-email', boundary: 'a@b.co (min valid)' },
            { field: 'New Password', validValue: 'NewSecure!Pass99', invalidValue: 'short', boundary: '8 chars exact: Abcde1!x' },
          ],
          expectedResult: 'User can log in with new password "NewSecure!Pass99". Old password "OldPass123!" no longer works.',
          priority: 'P0', priorityJustification: 'P0 because password reset is a critical account recovery path. Failure locks users out permanently if they forget their password.',
          riskIfNotTested: 'Users could be permanently locked out of their accounts, leading to support ticket surge and churn.',
          automationFeasibility: { automatable: true, framework: 'playwright', estimatedEffort: '45 min', notes: 'Requires email interception (Mailosaur/MailSlurp) for reset link extraction' },
          testDesignTechnique: 'EP', codeSnippet: '', gherkinOutput: '',
        },
        {
          id: 'TC-AUTH-002', category: 'negative', traceability: 'Covers AC-1: System validates email exists before sending reset',
          title: 'Password reset request with unregistered email shows generic message',
          description: 'Verifies the system does not reveal whether an email is registered (prevents account enumeration attack).',
          preconditions: ["No account exists for 'nonexistent@company.com'. User is on the /forgot-password page"],
          steps: [
            { action: "Type unregistered email in the 'Email' input field", testData: 'nonexistent@company.com', expected: "Email field accepts input. No inline validation error." },
            { action: "Click the 'Send Reset Link' button", testData: 'N/A', expected: "Same success message as valid email: 'Reset link sent to nonexistent@company.com'. NO error message revealing the email is not registered." },
          ],
          testDataTable: [
            { field: 'Email', validValue: 'nonexistent@company.com', invalidValue: 'N/A', boundary: 'N/A' },
          ],
          expectedResult: 'No email is actually sent. Response is identical to a valid email request (timing, message, status code). No account enumeration possible.',
          priority: 'P1', priorityJustification: 'P1 because account enumeration is an OWASP Top 10 risk. Attackers could harvest valid email addresses.',
          riskIfNotTested: 'Attackers enumerate valid accounts by observing different responses for registered vs unregistered emails, enabling targeted phishing.',
          automationFeasibility: { automatable: true, framework: 'playwright', estimatedEffort: '20 min', notes: 'Compare response body and timing between valid/invalid emails' },
          testDesignTechnique: 'EG', codeSnippet: '', gherkinOutput: '',
        },
        {
          id: 'TC-AUTH-003', category: 'edge_case', traceability: 'Covers AC-3: Reset link expires after 24 hours',
          title: 'Password reset with expired token (24h boundary) shows expiration error',
          description: 'Verifies the exact 24-hour expiration boundary for reset tokens using BVA.',
          preconditions: ["Reset token generated for 'john.doe@company.com' exactly 24 hours and 1 minute ago. User has the reset link in their email."],
          steps: [
            { action: 'Click the reset link from the email sent 24h+ ago', testData: 'Token: rst_expired_24h_token', expected: "Page loads /reset-password?token=rst_expired_24h_token. Error message: 'This reset link has expired. Please request a new one.'" },
            { action: "Click the 'Request new link' button on the expiration page", testData: 'N/A', expected: "Redirects to /forgot-password with email pre-filled" },
          ],
          testDataTable: [
            { field: 'Token Age', validValue: '23h 59m (just under limit)', invalidValue: '24h 1m (just over limit)', boundary: '24h 0m 0s (exact boundary)' },
          ],
          expectedResult: 'Expired token is rejected. User is guided to request a new reset link. No password change is possible with an expired token.',
          priority: 'P1', priorityJustification: 'P1 because expired tokens that still work create a security window — old emails in compromised inboxes could be used to hijack accounts.',
          riskIfNotTested: 'Reset tokens remain valid indefinitely, allowing attackers to use old reset emails from compromised mail accounts days or weeks later.',
          automationFeasibility: { automatable: true, framework: 'playwright', estimatedEffort: '30 min', notes: 'Requires ability to mock system time or pre-generate expired tokens in test DB' },
          testDesignTechnique: 'BVA', codeSnippet: '', gherkinOutput: '',
        },
        {
          id: 'TC-AUTH-004', category: 'negative', traceability: 'Covers AC-4: Password must meet complexity requirements',
          title: 'Password reset with weak password is rejected with specific feedback',
          description: 'Verifies all password complexity rules are enforced and specific error messages guide the user.',
          preconditions: ["User 'john.doe@company.com' has a valid (non-expired) reset token. User is on /reset-password page."],
          steps: [
            { action: "Type weak password in 'New Password' field", testData: 'abc', expected: "Inline validation shows: 'Password must be at least 8 characters' (real-time, as user types)" },
            { action: "Type password without special character", testData: 'Abcdefgh1', expected: "Inline validation shows: 'Password must contain at least one special character (!@#$%^&*)'" },
            { action: "Type password meeting all requirements", testData: 'SecureP@ss99', expected: "All validation checks show green. 'Reset Password' button becomes enabled." },
          ],
          testDataTable: [
            { field: 'Password', validValue: 'SecureP@ss99', invalidValue: 'abc', boundary: 'Abcde1!x (exactly 8 chars, minimum valid)' },
          ],
          expectedResult: 'Weak passwords are rejected with specific, actionable error messages. Only passwords meeting all complexity rules are accepted.',
          priority: 'P1', priorityJustification: 'P1 because weak passwords are the #1 attack vector for account compromise. Enforcement is a security baseline.',
          riskIfNotTested: 'Users set passwords like "123456" or "password", making accounts trivially compromisable via credential stuffing.',
          automationFeasibility: { automatable: true, framework: 'playwright', estimatedEffort: '25 min', notes: 'Test each validation rule independently. Data-driven with multiple password variants.' },
          testDesignTechnique: 'EP', codeSnippet: '', gherkinOutput: '',
        },
      ],
      coverageAnalysis: {
        requirementsCoverage: [
          { criterion: "AC-1: User clicks 'Forgot Password' on login page", testCaseIds: ['TC-AUTH-001', 'TC-AUTH-002'], status: 'Covered' },
          { criterion: 'AC-2: System sends reset email within 30 seconds', testCaseIds: ['TC-AUTH-001'], status: 'Covered' },
          { criterion: 'AC-3: Reset link expires after 24 hours', testCaseIds: ['TC-AUTH-003'], status: 'Covered' },
          { criterion: 'AC-4: Password must meet complexity requirements', testCaseIds: ['TC-AUTH-004'], status: 'Covered' },
          { criterion: 'AC-5: User receives confirmation after successful reset', testCaseIds: ['TC-AUTH-001'], status: 'Covered' },
        ],
        techniqueCoverage: [
          { technique: 'Equivalence Partitioning', applied: true, testCaseIds: ['TC-AUTH-001', 'TC-AUTH-004'] },
          { technique: 'Boundary Value Analysis', applied: true, testCaseIds: ['TC-AUTH-003'] },
          { technique: 'Error Guessing', applied: true, testCaseIds: ['TC-AUTH-002'] },
        ],
        gaps: [
          { area: 'Rate limiting on reset requests (e.g., max 5 per hour)', riskRating: 'Medium', recommendation: 'Add test TC-AUTH-005 to verify rate limit after 5 consecutive requests' },
          { area: 'Concurrent reset requests from multiple devices', riskRating: 'Low', recommendation: 'Add concurrency test to verify only latest token is valid' },
        ],
        coveredAreas: ['Happy path', 'Invalid email handling', 'Token expiration', 'Password complexity'],
        missingCoverage: ['Rate limiting', 'Concurrent device handling', 'Email deliverability monitoring'],
        recommendations: ['Add rate limiting tests', 'Add token invalidation on password change', 'Add accessibility tests for reset form'],
      },
      executionTemplate: {
        headers: ['Test Case ID', 'Status', 'Executed By', 'Date', 'Defect ID', 'Notes'],
        rows: [
          ['TC-AUTH-001', 'Not Run', '', '', '', ''],
          ['TC-AUTH-002', 'Not Run', '', '', '', ''],
          ['TC-AUTH-003', 'Not Run', '', '', '', ''],
          ['TC-AUTH-004', 'Not Run', '', '', '', ''],
        ],
      },
    });
  }
  if (systemPrompt.includes('principal API test automation') || systemPrompt.includes('API test automation')) {
    return JSON.stringify({
      endpoint: { method: 'POST', path: '/api/auth/login', description: 'Authenticates a user with email and password, returns JWT token and user profile', authentication: 'None (this is the login endpoint)', rateLimit: '5 requests per minute per IP' },
      testScripts: [
        {
          name: 'Happy path: Valid login returns 200 with token and user profile',
          description: 'WHY: Core authentication flow — if this breaks, no user can access the application. Validates complete response schema, not just status code.',
          category: 'happy_path',
          assertions: ['Status 200', 'Response time < 500ms', 'Content-Type: application/json', 'Body contains token (string, JWT format)', 'Body contains user.id (string)', 'Body contains user.email (string, matches input)', 'Body contains user.name (string)'],
          code: `import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REQUEST_ID = \`test-\${Date.now()}\`;

test.describe('POST /api/auth/login - Happy Path', () => {
  test('valid credentials return 200 with token and user profile', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': REQUEST_ID,
      },
      data: {
        email: 'qa.tester@company.com',
        password: 'SecureP@ss123!',
      },
    });
    const elapsed = Date.now() - startTime;

    // 1. Status code
    expect(response.status()).toBe(200);

    // 2. Response time SLA
    expect(elapsed).toBeLessThan(500);

    // 3. Content-Type header
    expect(response.headers()['content-type']).toContain('application/json');

    // 4. JSON schema & field validation
    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.')).toHaveLength(3); // JWT format: header.payload.signature

    expect(body).toHaveProperty('user');
    expect(typeof body.user.id).toBe('string');
    expect(body.user.email).toBe('qa.tester@company.com');
    expect(typeof body.user.name).toBe('string');
    expect(body.user).not.toHaveProperty('password');
    expect(body.user).not.toHaveProperty('passwordHash');
  });
});`,
        },
        {
          name: 'Auth: Missing Authorization token returns 401',
          description: 'WHY: Unauthenticated requests to protected endpoints must be rejected. Verifies consistent error response format.',
          category: 'auth',
          assertions: ['Status 401', 'Content-Type: application/json', 'Error response has consistent structure {error, message}'],
          code: `test('missing auth token returns 401 with error body', async ({ request }) => {
  const response = await request.get(\`\${BASE_URL}/api/users/me\`, {
    headers: { 'X-Request-ID': \`test-noauth-\${Date.now()}\` },
    // Intentionally no Authorization header
  });

  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toHaveProperty('error');
  expect(body.error).toBe('Unauthorized');
});`,
        },
        {
          name: 'Auth: Invalid/malformed token returns 401',
          description: 'WHY: Prevents access with forged or corrupted tokens. Ensures the server validates token signature, not just presence.',
          category: 'auth',
          assertions: ['Status 401', 'Rejects malformed JWT', 'Consistent error format'],
          code: `test('malformed token returns 401', async ({ request }) => {
  const response = await request.get(\`\${BASE_URL}/api/users/me\`, {
    headers: {
      'Authorization': 'Bearer this.is.not.a.valid.jwt.token',
      'X-Request-ID': \`test-badtoken-\${Date.now()}\`,
    },
  });

  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});`,
        },
        {
          name: 'Validation: Missing required email field returns 400',
          description: 'WHY: API must reject incomplete payloads with field-specific error messages so clients can display correct form errors.',
          category: 'validation',
          assertions: ['Status 400', 'Error message references missing field name', 'Response time < 200ms (validation is fast)'],
          code: `test('missing email returns 400 with field-specific error', async ({ request }) => {
  const startTime = Date.now();
  const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': \`test-noemail-\${Date.now()}\` },
    data: { password: 'SecureP@ss123!' },
    // email intentionally omitted
  });
  const elapsed = Date.now() - startTime;

  expect(response.status()).toBe(400);
  expect(elapsed).toBeLessThan(200); // Validation should be fast
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toHaveProperty('error');
  expect(body.error.toLowerCase()).toContain('email');
});`,
        },
        {
          name: 'Validation: Wrong field type (number instead of string) returns 400',
          description: 'WHY: Type coercion bugs can cause downstream errors. API should reject wrong types at the boundary.',
          category: 'validation',
          assertions: ['Status 400', 'Rejects numeric email', 'Consistent error format'],
          code: `test('numeric email returns 400', async ({ request }) => {
  const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 12345, password: 'SecureP@ss123!' },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});`,
        },
        {
          name: 'Edge case: Empty request body returns 400',
          description: 'WHY: Empty bodies can cause unhandled JSON parse errors or null pointer exceptions if not explicitly validated.',
          category: 'edge_case',
          assertions: ['Status 400', 'Does not return 500 (no unhandled exception)', 'Consistent error format'],
          code: `test('empty body returns 400, not 500', async ({ request }) => {
  const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
    headers: { 'Content-Type': 'application/json' },
    data: {},
  });

  // Must be 400 (client error), never 500 (server crash)
  expect(response.status()).toBe(400);
  expect(response.status()).not.toBe(500);

  const body = await response.json();
  expect(body).toHaveProperty('error');
});`,
        },
        {
          name: 'Edge case: SQL injection in email field is safely handled',
          description: "WHY: SQL injection is OWASP #1. Even if using an ORM, we must verify the API doesn't expose raw DB errors or allow injection.",
          category: 'edge_case',
          assertions: ['Status 400 or 401 (not 500)', 'No SQL error in response body', 'No data leakage'],
          code: `test('SQL injection attempt returns safe error', async ({ request }) => {
  const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: "' OR '1'='1'; DROP TABLE users; --",
      password: 'anything',
    },
  });

  // Should be 400 (invalid email) or 401 (invalid credentials), never 500
  expect([400, 401]).toContain(response.status());

  const body = await response.json();
  const bodyStr = JSON.stringify(body).toLowerCase();
  // Must not leak SQL errors
  expect(bodyStr).not.toContain('syntax error');
  expect(bodyStr).not.toContain('pg_');
  expect(bodyStr).not.toContain('select');
  expect(bodyStr).not.toContain('table');
});`,
        },
        {
          name: 'Rate limit: Repeated requests trigger 429',
          description: 'WHY: Login endpoints are brute-force targets. Rate limiting is a security requirement. Verify Retry-After header is present.',
          category: 'rate_limit',
          assertions: ['Status 429 after exceeding limit', 'Retry-After header present', 'Consistent error format'],
          code: `test('exceeding rate limit returns 429 with Retry-After', async ({ request }) => {
  // Send requests up to the documented limit (5/min)
  const results = [];
  for (let i = 0; i < 7; i++) {
    const response = await request.post(\`\${BASE_URL}/api/auth/login\`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'ratelimit@test.com', password: 'wrong' },
    });
    results.push(response.status());
  }

  // At least one request should be rate-limited
  const rateLimited = results.filter(s => s === 429);
  expect(rateLimited.length).toBeGreaterThan(0);

  // Note: In real tests, also check response.headers()['retry-after']
});`,
        },
      ],
      setupCode: `// ── Setup & Teardown ────────────────────────────────────────
import { test as setup } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let authToken: string;
let testUserId: string;

// Create test user and get auth token before all tests
setup.beforeAll(async ({ request }) => {
  // Create test user
  const createRes = await request.post(\`\${BASE_URL}/api/auth/register\`, {
    data: { name: 'QA Tester', email: 'qa.tester@company.com', password: 'SecureP@ss123!' },
  });
  const user = await createRes.json();
  testUserId = user.id;

  // Get auth token
  const loginRes = await request.post(\`\${BASE_URL}/api/auth/login\`, {
    data: { email: 'qa.tester@company.com', password: 'SecureP@ss123!' },
  });
  const loginData = await loginRes.json();
  authToken = loginData.token;
});

// Clean up test user after all tests
setup.afterAll(async ({ request }) => {
  if (testUserId) {
    await request.delete(\`\${BASE_URL}/api/users/\${testUserId}\`, {
      headers: { Authorization: \`Bearer \${authToken}\` },
    });
  }
});`,
      teardownCode: `// Cleanup is handled in afterAll above`,
      envVariables: {
        BASE_URL: 'http://localhost:3000',
        AUTH_TOKEN: '{{generated_at_runtime_in_beforeAll}}',
        TEST_USER_ID: '{{created_in_setup}}',
        REQUEST_TIMEOUT_MS: '5000',
        DEBUG_LOGGING: 'false',
      },
      totalTests: 8,
    });
  }
  if (systemPrompt.includes('principal technical writer') || systemPrompt.includes('release notes')) {
    const d = new Date().toISOString().split('T')[0];
    return JSON.stringify({
      version: '3.0.0',
      versionBump: 'major',
      versionRationale: 'Contains breaking change: removed /api/v1 endpoints. This requires a MAJOR version bump per SemVer 2.0.0.',
      preReleaseLabel: null,
      date: d,
      title: 'Dark Mode, Performance Boost & v1 API Sunset',
      summary: 'Adds dark mode, improves dashboard load speed by 40%, fixes critical SSO crash, and removes deprecated v1 API endpoints.',
      changelog: {
        added: [
          { description: 'Dark mode theme with system preference detection', ticket: 'FEAT-123', component: 'UI/Theme' },
          { description: 'File upload progress indicator with cancel support', ticket: 'FEAT-124', component: 'Upload' },
        ],
        changed: [
          { description: 'Dashboard lazy-loads widgets — 40% faster initial render', ticket: 'PERF-456', component: 'Dashboard' },
        ],
        deprecated: [
          { description: '/api/v1/webhooks endpoint — use /api/v2/webhooks instead. Will be removed in v4.0.0', ticket: 'DEP-010', component: 'API' },
        ],
        removed: [
          { description: '/api/v1/* endpoints removed — all consumers must migrate to /api/v2/*', ticket: 'BREAK-001', component: 'API' },
        ],
        fixed: [
          { description: 'SSO login crash when OAuth provider returns non-standard token format', ticket: 'BUG-789', component: 'Authentication', severity: 'critical' },
          { description: 'Currency symbol not updating when user changes region', ticket: 'BUG-790', component: 'Localization', severity: 'medium' },
          { description: 'Search pagination count incorrect after applying filters', ticket: 'BUG-791', component: 'Search', severity: 'low' },
        ],
        security: [
          { description: 'Patched XSS vulnerability in user profile bio field (CVE-2026-XXXX)', ticket: 'SEC-101', component: 'User Profile', severity: 'high' },
        ],
      },
      engineeringNotes: {
        deploymentSteps: [
          '1. Run database migrations: npx prisma migrate deploy',
          '2. Set new env var: DARK_MODE_ENABLED=true',
          '3. Deploy API service first (handles both v1 and v2 during rollout)',
          '4. Deploy frontend after API is healthy',
          '5. Verify health check: GET /api/health returns 200',
          '6. Monitor error rates for 30 minutes post-deploy',
        ],
        migrations: [
          { type: 'database', description: 'Add user_preferences.theme column (nullable, default null)', command: 'npx prisma migrate deploy', rollbackCommand: 'npx prisma migrate rollback --steps 1' },
          { type: 'config', description: 'Add DARK_MODE_ENABLED env var', command: 'echo "DARK_MODE_ENABLED=true" >> .env', rollbackCommand: 'Remove DARK_MODE_ENABLED from .env' },
        ],
        configChanges: [
          { variable: 'DARK_MODE_ENABLED', action: 'add', value: 'true', description: 'Feature flag for dark mode rollout' },
          { variable: 'V1_API_SUNSET_DATE', action: 'remove', value: '', description: 'No longer needed — v1 is removed' },
        ],
        breakingChanges: [
          {
            title: 'Removed /api/v1/* endpoints',
            description: 'All v1 API endpoints have been removed. Consumers must migrate to v2.',
            before: 'GET /api/v1/users → { users: [...] }',
            after: 'GET /api/v2/users → { data: [...], meta: { page, limit, total } }',
            migrationGuide: '1. Update base URL from /api/v1 to /api/v2\n2. Update response parsing: users array is now under .data key\n3. Pagination uses meta object instead of X-Total-Count header',
          },
        ],
        performanceImpact: [
          { area: 'Dashboard initial load', before: '2.8s', after: '1.7s', improvement: '40% faster' },
          { area: 'SSO login flow', before: 'Crash on non-standard tokens', after: '< 500ms with graceful fallback', improvement: 'Fixed crash + improved resilience' },
        ],
        riskAssessment: {
          overallRisk: 'Medium',
          rollbackComplexity: 'Moderate',
          requiresDowntime: false,
          justification: 'Breaking API change requires coordination with API consumers. Database migration is additive (nullable column) so rollback is safe. No downtime required — v2 endpoints already existed.',
        },
        rollbackProcedure: '1. Revert frontend to previous version\n2. Revert API to previous version (v1 endpoints will return)\n3. Rollback database migration: npx prisma migrate rollback --steps 1\n4. Remove DARK_MODE_ENABLED env var\n5. Verify health check and smoke test',
        markdownOutput: `# Engineering Release Notes — v3.0.0\n\n**Date:** ${d}\n**Risk:** Medium | **Rollback:** Moderate | **Downtime:** No\n\n## Deployment Steps\n1. Run migrations\n2. Set env vars\n3. Deploy API → Frontend\n4. Monitor 30min\n\n## Breaking Changes\n### Removed /api/v1/* endpoints\nMigrate to /api/v2/*. See migration guide above.\n\n## Rollback\nRevert both services, rollback migration, remove env vars.`,
      },
      customerNotes: {
        highlights: [
          { title: 'Dark mode is here', description: 'Reduce eye strain with our new dark theme. It automatically matches your system preference, or you can set it manually in Settings.' },
          { title: 'Faster dashboards', description: 'Your dashboard now loads 40% faster. We optimized how widgets render so you see your data sooner.' },
          { title: 'See your upload progress', description: 'When uploading files, you now see a real-time progress bar with the option to cancel mid-upload.' },
        ],
        improvements: [
          { title: 'Smoother currency switching', description: 'Changing your region now instantly updates all currency symbols across the app.' },
          { title: 'More accurate search results', description: 'Pagination counts now stay correct when you filter your search results.' },
        ],
        fixes: [
          { title: 'SSO login reliability', description: 'Fixed a rare issue where signing in with your company SSO could fail. SSO login is now more reliable across all identity providers.' },
        ],
        knownIssues: [
          { title: 'Charts flicker on Safari 17', description: 'Some chart animations may flicker on Safari 17. This is being investigated.', workaround: 'Use Chrome or Firefox for the best experience, or disable animations in Settings > Accessibility.' },
        ],
        markdownOutput: `# What's New in v3.0.0\n\n## Highlights\n\n### 🌙 Dark mode is here\nReduce eye strain with our new dark theme.\n\n### ⚡ Faster dashboards\nYour dashboard now loads 40% faster.\n\n### 📤 See your upload progress\nReal-time progress bar with cancel support.\n\n## Improvements\n- Currency symbols update instantly when changing region\n- Search pagination counts are now accurate\n\n## Fixes\n- SSO login is now more reliable across all providers\n\n## Known Issues\n- Charts may flicker on Safari 17 (workaround: use Chrome/Firefox)`,
      },
      slackOutput: `🚀 *v3.0.0 Released — Dark Mode, Performance & API Sunset*\n\n✨ *Dark mode* — matches your system preference or set manually\n⚡ *40% faster dashboards* — optimized widget rendering\n🔒 *Security patch* — XSS vulnerability fixed in user profiles\n🐛 *SSO login fix* — resolved crash for enterprise SSO users\n\n⚠️ *Breaking:* /api/v1 endpoints have been removed. Migrate to /api/v2.\n\n📋 Full release notes: <https://docs.company.com/releases/v3.0.0|Read more>`,
      // Backward compat
      sections: {
        newFeatures: [
          { title: 'Dark mode support', description: 'Full dark mode theme with system preference detection', ticket: 'FEAT-123' },
          { title: 'Upload progress indicator', description: 'Real-time progress bar with cancel support', ticket: 'FEAT-124' },
        ],
        improvements: [
          { title: 'Dashboard performance', description: '40% faster initial load with lazy-loaded widgets', ticket: 'PERF-456' },
        ],
        bugFixes: [
          { title: 'SSO login crash', description: 'Fixed crash when OAuth provider returns non-standard token format', ticket: 'BUG-789', severity: 'critical' },
          { title: 'Currency symbol update', description: 'Currency symbol now updates when user changes region', ticket: 'BUG-790', severity: 'medium' },
        ],
        breakingChanges: [
          { title: 'Removed /api/v1 endpoints', description: 'All v1 API endpoints removed. Migrate to /api/v2.', migration: 'Update base URL, response parsing (.data key), and pagination (meta object)' },
        ],
        knownIssues: [
          { title: 'Safari chart flicker', description: 'Charts may flicker on Safari 17', workaround: 'Use Chrome/Firefox or disable animations in Settings > Accessibility' },
        ],
      },
      markdownOutput: `# Changelog\n\nAll notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n## [3.0.0] - ${d}\n\n### Added\n- Dark mode theme with system preference detection (FEAT-123) [UI/Theme]\n- File upload progress indicator with cancel (FEAT-124) [Upload]\n\n### Changed\n- Dashboard lazy-loads widgets — 40% faster (PERF-456) [Dashboard]\n\n### Deprecated\n- /api/v1/webhooks — use /api/v2/webhooks (DEP-010) [API]\n\n### Removed\n- /api/v1/* endpoints — migrate to /api/v2/* (BREAK-001) [API]\n\n### Fixed\n- SSO login crash on non-standard OAuth tokens (BUG-789) [Auth]\n- Currency symbol not updating on region change (BUG-790) [Localization]\n- Search pagination count after filtering (BUG-791) [Search]\n\n### Security\n- Patched XSS in user profile bio (SEC-101) [User Profile]`,
    });
  }
  if (systemPrompt.includes('principal test data engineer') || systemPrompt.includes('test data')) {
    return JSON.stringify({
      scenario: 'User registration form',
      schema: {
        fields: [
          { name: 'name', type: 'string', constraints: '2-50 characters', nullable: false, piiClassification: 'PII' },
          { name: 'email', type: 'email', constraints: 'unique, RFC 5322 format', nullable: false, piiClassification: 'PII' },
          { name: 'password', type: 'string', constraints: '8+ chars, 1 upper, 1 number, 1 special', nullable: false, piiClassification: 'Sensitive' },
          { name: 'age', type: 'number', constraints: '18-120', nullable: true, piiClassification: 'PII' },
          { name: 'role', type: 'enum', constraints: 'admin|editor|viewer', nullable: false, piiClassification: 'Public' },
        ],
      },
      validData: [
        { name: 'Aisha Patel', email: 'aisha.patel@techcorp.in', password: 'Str0ng!Pass', age: 28, role: 'editor' },
        { name: 'Carlos Mendes', email: 'c.mendes@empresa.br', password: 'C@rlos2024!', age: 34, role: 'viewer' },
        { name: 'Yuki Tanaka', email: 'y.tanaka@company.jp', password: 'Yuk1T@naka!', age: 41, role: 'admin' },
        { name: 'Fatima Al-Hassan', email: 'fatima.h@corp.ae', password: 'F@tima99!x', age: 26, role: 'editor' },
        { name: "Siobhán O'Brien", email: 'siobhan.ob@mail.ie', password: "S!obhan_88", age: 55, role: 'viewer' },
      ],
      bvaTable: [
        {
          field: 'name', constraint: '2-50 characters',
          min_minus_1: { value: 'A', expected: 'FAIL', reason: '1 char — below minimum of 2' },
          min: { value: 'Li', expected: 'PASS', reason: 'Exactly 2 chars — minimum boundary' },
          min_plus_1: { value: 'Ana', expected: 'PASS', reason: '3 chars — just above minimum' },
          nominal: { value: 'Alexander Kim', expected: 'PASS', reason: '13 chars — typical length' },
          max_minus_1: { value: 'A'.repeat(49), expected: 'PASS', reason: '49 chars — just below maximum' },
          max: { value: 'A'.repeat(50), expected: 'PASS', reason: 'Exactly 50 chars — maximum boundary' },
          max_plus_1: { value: 'A'.repeat(51), expected: 'FAIL', reason: '51 chars — exceeds maximum of 50' },
        },
        {
          field: 'age', constraint: '18-120',
          min_minus_1: { value: 17, expected: 'FAIL', reason: '17 — below minimum age of 18' },
          min: { value: 18, expected: 'PASS', reason: 'Exactly 18 — minimum age boundary' },
          min_plus_1: { value: 19, expected: 'PASS', reason: '19 — just above minimum' },
          nominal: { value: 35, expected: 'PASS', reason: 'Typical age' },
          max_minus_1: { value: 119, expected: 'PASS', reason: '119 — just below maximum' },
          max: { value: 120, expected: 'PASS', reason: 'Exactly 120 — maximum boundary' },
          max_plus_1: { value: 121, expected: 'FAIL', reason: '121 — exceeds maximum age of 120' },
        },
      ],
      equivalencePartitions: [
        {
          field: 'email',
          validClasses: [
            { class: 'Standard format', representative: 'user@domain.com' },
            { class: 'Subdomain', representative: 'user@mail.domain.co.uk' },
            { class: 'Plus addressing', representative: 'user+tag@domain.com' },
            { class: 'Numeric local part', representative: '12345@domain.com' },
          ],
          invalidClasses: [
            { class: 'Missing @ symbol', representative: 'userdomain.com', expectedError: 'Invalid email format' },
            { class: 'Missing domain', representative: 'user@', expectedError: 'Invalid email format' },
            { class: 'Double @', representative: 'user@@domain.com', expectedError: 'Invalid email format' },
            { class: 'Spaces in address', representative: 'user name@domain.com', expectedError: 'Invalid email format' },
          ],
        },
        {
          field: 'password',
          validClasses: [
            { class: 'Meets all requirements', representative: 'Str0ng!Pass' },
            { class: 'Minimum length (8)', representative: 'Abcde1!' + 'x' },
            { class: 'With special chars variety', representative: 'P@$$w0rd!#' },
          ],
          invalidClasses: [
            { class: 'Too short (7 chars)', representative: 'Ab1!xyz', expectedError: 'Password must be at least 8 characters' },
            { class: 'No uppercase', representative: 'abcde1!x', expectedError: 'Password must contain an uppercase letter' },
            { class: 'No number', representative: 'Abcdefg!', expectedError: 'Password must contain a number' },
            { class: 'No special char', representative: 'Abcdefg1', expectedError: 'Password must contain a special character' },
          ],
        },
      ],
      edgeCaseData: [
        { name: '田中太郎', email: 'tanaka@example.jp', password: 'T@naka123!', age: 30, role: 'viewer', _note: 'CJK characters in name', _category: 'unicode' },
        { name: '👩‍💻 Dev', email: 'emoji@test.com', password: 'Em0ji!Test', age: 25, role: 'editor', _note: 'Emoji in name field', _category: 'unicode' },
        { name: 'محمد عبدالله', email: 'mohammed@test.sa', password: 'M0hammed!x', age: 40, role: 'viewer', _note: 'RTL Arabic text in name', _category: 'unicode' },
        { name: "O'Malley-Smith Jr.", email: 'omalley@test.com', password: "O'M@lley1!", age: 45, role: 'admin', _note: 'Apostrophe and hyphen in name — tests SQL escaping', _category: 'injection' },
        { name: "'; DROP TABLE users; --", email: 'sql@inject.com', password: 'Inj3ct!on_', age: 30, role: 'viewer', _note: 'SQL injection attempt in name field', _category: 'injection' },
        { name: '<script>alert("xss")</script>', email: 'xss@test.com', password: 'X$$_t3st!', age: 28, role: 'viewer', _note: 'XSS payload in name — should be escaped, not executed', _category: 'injection' },
        { name: 'Li', email: 'li@test.com', password: 'LiL!_123x', age: 18, role: 'viewer', _note: 'Minimum valid name (2 chars) + minimum valid age (18)', _category: 'boundary' },
        { name: 'Test User', email: 'expired-sub@test.com', password: 'Exp1red!x', age: 65, role: 'admin', _note: 'State: user with expired subscription + payment method on file + 3 failed payment attempts', _category: 'state' },
      ],
      invalidData: [
        { name: '', email: 'valid@test.com', password: 'V@lid123!', age: 25, role: 'viewer', _note: 'Empty name', _expectedError: 'Name is required', _category: 'missing_required' },
        { name: 'Valid Name', email: 'not-an-email', password: 'V@lid123!', age: 25, role: 'viewer', _note: 'Malformed email', _expectedError: 'Invalid email format', _category: 'format' },
        { name: 'Valid Name', email: 'valid@test.com', password: 'short', age: 25, role: 'viewer', _note: 'Password too short', _expectedError: 'Password must be at least 8 characters', _category: 'out_of_range' },
        { name: 'Valid Name', email: 'valid@test.com', password: 'V@lid123!', age: 15, role: 'viewer', _note: 'Age below minimum (15 < 18)', _expectedError: 'Must be at least 18 years old', _category: 'out_of_range' },
        { name: 'Valid Name', email: 'valid@test.com', password: 'V@lid123!', age: 25, role: 'superadmin', _note: 'Invalid role enum value', _expectedError: 'Role must be admin, editor, or viewer', _category: 'format' },
        { name: 123, email: 'valid@test.com', password: 'V@lid123!', age: 25, role: 'viewer', _note: 'Wrong type: number instead of string for name', _expectedError: 'Name must be a string', _category: 'wrong_type' },
      ],
      dataMasking: [
        { field: 'name', piiType: 'Personal Name', technique: 'Substitution', example: 'Replace with synthetic name from same locale/ethnicity distribution' },
        { field: 'email', piiType: 'Email Address', technique: 'Domain Substitution', example: 'Keep local part format, replace domain: aisha.patel@[masked].com' },
        { field: 'password', piiType: 'Credential', technique: 'Redaction', example: 'Never store, display, or log — replace with [REDACTED]' },
        { field: 'age', piiType: 'Demographic', technique: 'Generalization', example: 'Replace exact age with age range: 25-34' },
      ],
      formattedOutput: JSON.stringify([
        { name: 'Aisha Patel', email: 'aisha.patel@techcorp.in', password: 'Str0ng!Pass', age: 28, role: 'editor' },
        { name: 'Carlos Mendes', email: 'c.mendes@empresa.br', password: 'C@rlos2024!', age: 34, role: 'viewer' },
        { name: 'Yuki Tanaka', email: 'y.tanaka@company.jp', password: 'Yuk1T@naka!', age: 41, role: 'admin' },
      ], null, 2),
      totalRecords: 19,
    });
  }
  if (systemPrompt.includes('QA Director creating a sprint test plan') || systemPrompt.includes('sprint test plan')) {
    return JSON.stringify({
      testPlan: {
        sprintName: 'Sprint 24 — Auth Improvements',
        sprintDates: 'Mar 18 – Mar 29, 2026',
        version: '1.0',
        author: 'QA Lead',
        approvalStatus: 'Draft',
        objective: 'Validate all authentication enhancements (2FA, social login, account lockout) are secure, accessible, and regression-free before release to production.',
        estimatedHours: 52,
        testEnvironments: ['QA', 'Staging'],
      },
      scope: {
        inScope: [
          { storyId: 'US-401', title: 'Implement 2FA via SMS and authenticator app', acceptanceCriteria: ['AC-1: User can enable 2FA from security settings', 'AC-2: SMS code delivered within 30s', 'AC-3: Authenticator app QR code scannable', 'AC-4: Backup codes generated (10 single-use codes)'] },
          { storyId: 'US-402', title: 'Remember device option for 2FA', acceptanceCriteria: ['AC-1: "Remember this device" checkbox on 2FA screen', 'AC-2: Remembered devices skip 2FA for 30 days', 'AC-3: User can revoke remembered devices'] },
          { storyId: 'US-404', title: 'Account lockout after 5 failures', acceptanceCriteria: ['AC-1: Account locked after 5 consecutive failures', 'AC-2: Lockout duration is 15 minutes', 'AC-3: Admin can unlock immediately'] },
          { storyId: 'BUG-891', title: 'Fix session timeout redirect', acceptanceCriteria: ['AC-1: Expired session redirects to /login with message'] },
        ],
        outOfScope: [
          { item: 'US-405 Social login (Google, GitHub)', reason: 'Moved to Sprint 25 — waiting on OAuth credentials from security team' },
          { item: 'Performance load testing', reason: 'Scheduled for hardening sprint after feature complete' },
        ],
      },
      riskMatrix: [
        { riskId: 'R-001', description: '2FA SMS delivery depends on third-party Twilio API', likelihood: 3, impact: 5, score: 15, mitigation: 'Mock SMS in QA env, test real SMS in staging only', owner: 'QA1' },
        { riskId: 'R-002', description: 'Account lockout could lock out legitimate users if threshold too aggressive', likelihood: 4, impact: 4, score: 16, mitigation: 'Test with exact boundary (4, 5, 6 attempts), verify unlock flow', owner: 'QA2' },
        { riskId: 'R-003', description: 'Session timeout fix may affect existing session persistence', likelihood: 2, impact: 3, score: 6, mitigation: 'Include session persistence in regression suite', owner: 'QA1' },
      ],
      testingQuadrants: {
        q1: { label: 'Unit/TDD (Dev-owned)', items: ['Unit tests for TOTP code generation', 'Unit tests for lockout counter logic', 'Unit tests for session timeout calculation'] },
        q2: { label: 'Functional/BDD (QA Automation)', items: ['Automated 2FA setup flow', 'Automated login with 2FA verification', 'Automated lockout trigger and recovery', 'Automated session timeout redirect'] },
        q3: { label: 'Exploratory/UAT (QA Manual)', items: ['Exploratory: 2FA setup on different mobile devices', 'Exploratory: UX of lockout messaging', 'UAT: end-to-end auth flow with stakeholders'] },
        q4: { label: 'Performance/Security (Tooling)', items: ['Brute force resistance verification', 'TOTP timing attack resistance', 'Session token entropy validation'] },
      },
      estimation: [
        { storyId: 'US-401', title: '2FA Implementation', testDesignHrs: 4, testExecutionHrs: 8, automationHrs: 6, regressionHrs: 2, totalHrs: 20, assignee: 'QA1' },
        { storyId: 'US-402', title: 'Remember Device', testDesignHrs: 2, testExecutionHrs: 4, automationHrs: 3, regressionHrs: 1, totalHrs: 10, assignee: 'QA1' },
        { storyId: 'US-404', title: 'Account Lockout', testDesignHrs: 2, testExecutionHrs: 5, automationHrs: 3, regressionHrs: 1, totalHrs: 11, assignee: 'QA2' },
        { storyId: 'BUG-891', title: 'Session Timeout Fix', testDesignHrs: 1, testExecutionHrs: 2, automationHrs: 1, regressionHrs: 2, totalHrs: 6, assignee: 'QA2' },
      ],
      resourceAllocation: [
        { member: 'QA1', primaryStories: ['US-401', 'US-402'], backup: ['BUG-891'], regressionAreas: ['Authentication', 'Session Management'] },
        { member: 'QA2', primaryStories: ['US-404', 'BUG-891'], backup: ['US-401'], regressionAreas: ['Login Flow', 'Password Reset'] },
      ],
      stories: [
        { storyId: 'US-401', title: '2FA via SMS and authenticator', riskLevel: 'high', testCases: [
          { title: 'Enable 2FA with authenticator app', type: 'functional', priority: 'P0', estimatedMinutes: 30, assignee: 'QA1' },
          { title: 'Login with valid TOTP code', type: 'e2e', priority: 'P0', estimatedMinutes: 20, assignee: 'QA1' },
          { title: 'Login with invalid TOTP code', type: 'functional', priority: 'P1', estimatedMinutes: 15, assignee: 'QA1' },
          { title: 'Backup code usage and single-use enforcement', type: 'functional', priority: 'P1', estimatedMinutes: 25, assignee: 'QA1' },
        ], testDataNeeded: 'Test phone number for SMS, authenticator app on test device' },
        { storyId: 'US-404', title: 'Account lockout after 5 failures', riskLevel: 'high', testCases: [
          { title: 'Account locks on 5th failed attempt', type: 'functional', priority: 'P0', estimatedMinutes: 20, assignee: 'QA2' },
          { title: 'Account unlocks after 15 min', type: 'functional', priority: 'P0', estimatedMinutes: 20, assignee: 'QA2' },
          { title: 'Admin can unlock account immediately', type: 'functional', priority: 'P1', estimatedMinutes: 15, assignee: 'QA2' },
        ], testDataNeeded: 'Test user account, admin account for unlock testing' },
      ],
      regressionSuite: [
        { area: 'Login Flow', reason: 'All auth changes impact the login flow', tests: 12, estimatedMinutes: 45, priority: 'P1' },
        { area: 'Password Reset', reason: 'Session changes may affect reset token handling', tests: 6, estimatedMinutes: 25, priority: 'P1' },
        { area: 'Session Persistence', reason: 'BUG-891 fix directly modifies session behavior', tests: 8, estimatedMinutes: 30, priority: 'P1' },
        { area: 'Dashboard Access', reason: 'Auth changes could affect post-login routing', tests: 5, estimatedMinutes: 15, priority: 'P2' },
      ],
      schedule: [
        { day: 1, activities: ['Environment verification and smoke test', 'Test case design review', 'Test data preparation'], milestone: 'Test readiness confirmed' },
        { day: 2, activities: ['P0 test execution: 2FA setup and login', 'P0 test execution: Account lockout trigger'], milestone: '' },
        { day: 3, activities: ['P0 test execution: Session timeout fix', 'P1 test execution: Backup codes, invalid TOTP', 'Begin automation for 2FA flow'], milestone: '' },
        { day: 4, activities: ['P1 test execution: Remember device, admin unlock', 'Automation: lockout scenarios'], milestone: 'All P0 tests complete' },
        { day: 5, activities: ['Exploratory testing: 2FA on different devices', 'Edge case testing: rapid login attempts', 'Defect retesting'], milestone: '' },
        { day: 6, activities: ['Regression suite execution: Login + Password Reset', 'Continue automation'], milestone: '' },
        { day: 7, activities: ['Regression suite execution: Session + Dashboard', 'Final defect retesting', 'Test summary report preparation'], milestone: 'Regression complete' },
        { day: 8, activities: ['Sign-off meeting preparation', 'Go/No-Go recommendation', 'Documentation update'], milestone: 'Sprint QA sign-off' },
      ],
      environmentAndData: [
        { environment: 'QA', url: 'https://qa.app.com', purpose: 'Functional and integration testing', dataRequirements: 'Seeded test users with various roles, mock SMS provider', refreshSchedule: 'Daily at 6 AM UTC' },
        { environment: 'Staging', url: 'https://staging.app.com', purpose: 'E2E and regression testing', dataRequirements: 'Production-like data subset, real SMS for final verification', refreshSchedule: 'Weekly Sunday night' },
      ],
      entryExitCriteria: {
        entry: ['Code complete and merged to release branch', 'Unit tests passing with >80% coverage on new code', 'Build successfully deployed to QA environment', 'Test data seeded and verified', 'No open blocker defects from previous sprint'],
        exit: ['All P0 tests passed', 'All P1 tests passed (or deferred with PM approval)', 'No open Critical or High severity defects', 'Regression pass rate ≥ 95%', 'Code coverage ≥ 80% on new code', 'Performance benchmarks met (login < 500ms)', 'QA sign-off obtained'],
      },
      dependencies: [
        { dependency: 'Twilio SMS sandbox access for 2FA testing', type: 'external', status: 'resolved', owner: 'DevOps' },
        { dependency: 'QA environment database refresh with auth schema changes', type: 'environment', status: 'pending', owner: 'DBA' },
        { dependency: 'Admin unlock API endpoint must be complete before Day 4', type: 'team', status: 'pending', owner: 'Backend Dev' },
      ],
      definitionOfDone: [
        'All acceptance criteria verified with test evidence',
        'Automated tests added for all P0 scenarios',
        'Regression suite passed with ≥ 95% pass rate',
        'No open P0/P1 defects',
        'Test summary report delivered',
        'Stakeholder sign-off recorded',
        'Knowledge base / test documentation updated',
      ],
      risks: [
        { risk: 'Twilio sandbox rate limits may block SMS testing', mitigation: 'Use mock SMS in QA, real SMS in staging only for final verification', probability: 'medium' },
        { risk: 'Account lockout threshold may need tuning after UAT feedback', mitigation: 'Make lockout threshold configurable (env variable), plan for quick config change', probability: 'medium' },
        { risk: 'Session timeout fix regression could break existing sessions', mitigation: 'Comprehensive session regression suite on Day 6, monitor error rates post-deploy', probability: 'low' },
      ],
      markdownOutput: '# Sprint 24 Test Plan — Auth Improvements\n\n**[Company Name]** | **[Project Name]**\n\n| Field | Value |\n|-------|-------|\n| Sprint | Sprint 24 |\n| Dates | Mar 18–29, 2026 |\n| Version | 1.0 |\n| Author | QA Lead |\n| Status | Draft |\n\n---\n\n## 1. Test Objective\n\nValidate all authentication enhancements (2FA, social login, account lockout) are secure, accessible, and regression-free.\n\n## 2. Scope\n\n### In Scope\n- US-401: 2FA via SMS and authenticator\n- US-402: Remember device for 2FA\n- US-404: Account lockout after 5 failures\n- BUG-891: Session timeout redirect fix\n\n### Out of Scope\n- US-405: Social login (moved to Sprint 25)\n- Performance load testing (hardening sprint)\n\n---\n\n## Document Approval\n\n| Role | Name | Decision | Date |\n|------|------|----------|------|\n| QA Lead | ____________ | ____________ | ____________ |\n| Dev Lead | ____________ | ____________ | ____________ |\n| PM | ____________ | ____________ | ____________ |',
    });
  }
  if (systemPrompt.includes('principal test automation architect') || systemPrompt.includes('automation')) {
    return JSON.stringify({
      framework: 'playwright',
      language: 'typescript',
      projectStructure: `tests/
├── pages/
│   ├── BasePage.ts
│   └── LoginPage.ts
├── specs/
│   └── login.spec.ts
├── fixtures/
│   └── testData.ts
├── utils/
│   └── helpers.ts
└── config/
    └── playwright.config.ts`,
      files: [
        {
          filename: 'tests/pages/BasePage.ts',
          description: 'Abstract base page with common navigation, wait, and screenshot helpers',
          fileType: 'page_object',
          code: `import { Page, expect } from '@playwright/test';

/**
 * BasePage — abstract base for all page objects.
 * Provides common navigation, wait, and screenshot utilities.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to a path relative to BASE_URL */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /** Wait for the page to reach 'networkidle' state */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /** Capture a named screenshot (saved to test-results/) */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: \`test-results/screenshots/\${name}.png\`, fullPage: true });
  }

  /** Get the page title */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /** Assert the current URL matches the expected path */
  async expectURL(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }
}`,
        },
        {
          filename: 'tests/pages/LoginPage.ts',
          description: 'Page Object for the login page — encapsulates all locators and actions',
          fileType: 'page_object',
          code: `import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — encapsulates the login form interactions.
 * Locators use data-testid first, then getByRole/getByLabel.
 */
export class LoginPage extends BasePage {
  // ── Private locators (never exposed to tests) ──────────────
  private get emailInput(): Locator {
    return this.page.getByLabel('Email');
  }
  private get passwordInput(): Locator {
    return this.page.getByLabel('Password');
  }
  private get submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' });
  }
  private get errorBanner(): Locator {
    return this.page.getByRole('alert');
  }

  // ── Public actions ─────────────────────────────────────────

  /** Navigate to the login page */
  async navigate(): Promise<this> {
    await this.goto('/login');
    await this.waitForPageLoad();
    return this;
  }

  /**
   * Fill in email and password and submit the form.
   * @param email - User's email address
   * @param password - User's password
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Assert that the user was redirected to the dashboard */
  async expectLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\\/dashboard/, {
      timeout: 10000,
    });
  }

  /** Assert that an error message is displayed */
  async expectLoginError(message?: string): Promise<void> {
    await expect(this.errorBanner).toBeVisible();
    if (message) {
      await expect(this.errorBanner).toContainText(message);
    }
  }
}`,
        },
        {
          filename: 'tests/fixtures/testData.ts',
          description: 'Test data constants — valid, invalid, and edge-case values',
          fileType: 'fixture',
          code: `/**
 * Test data for login flow tests.
 * All values are safe for use in any environment.
 */
export const VALID_USER = {
  email: 'qa.tester@company.com',
  password: 'SecureP@ss123!',
  name: 'QA Tester',
} as const;

export const INVALID_CREDENTIALS = {
  wrongPassword: { email: VALID_USER.email, password: 'WrongPassword!' },
  wrongEmail: { email: 'nonexistent@company.com', password: 'AnyPass123!' },
  emptyEmail: { email: '', password: 'AnyPass123!' },
  emptyPassword: { email: VALID_USER.email, password: '' },
  sqlInjection: { email: "' OR '1'='1'; --", password: 'anything' },
  xssPayload: { email: '<script>alert("xss")</script>@test.com', password: 'Pass123!' },
} as const;`,
        },
        {
          filename: 'tests/utils/helpers.ts',
          description: 'Auth helpers, custom assertions, and utility functions',
          fileType: 'helper',
          code: `import { Page, expect } from '@playwright/test';

/**
 * Authenticate a user and return to the target page.
 * Uses the login form (for e2e) — switch to API auth for speed in non-auth tests.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\\/dashboard/);
}

/** Assert a toast notification appears with the expected message */
export async function expectToast(page: Page, message: string): Promise<void> {
  const toast = page.getByRole('status');
  await expect(toast).toContainText(message, { timeout: 5000 });
}

/** Generate a random email for test isolation */
export function randomEmail(): string {
  return \`test.\${Date.now()}.\${Math.random().toString(36).slice(2, 7)}@test.com\`;
}

/** Read environment variable with fallback */
export function getEnvVar(name: string, fallback: string): string {
  return process.env[name] || fallback;
}`,
        },
        {
          filename: 'tests/specs/login.spec.ts',
          description: 'Login flow test suite — independent tests covering happy path, validation, security',
          fileType: 'spec',
          code: `import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { VALID_USER, INVALID_CREDENTIALS } from '../fixtures/testData';

test.describe('Login Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  /** Happy path: valid credentials should redirect to dashboard */
  test('successful login with valid credentials', async ({ page }) => {
    await loginPage.login(VALID_USER.email, VALID_USER.password);
    await loginPage.expectLoginSuccess();

    // Verify user info is displayed in the header
    await expect(page.getByText(VALID_USER.name)).toBeVisible();
  });

  /** Negative: wrong password should show error, not crash */
  test('wrong password shows error message', async () => {
    await loginPage.login(
      INVALID_CREDENTIALS.wrongPassword.email,
      INVALID_CREDENTIALS.wrongPassword.password,
    );
    await loginPage.expectLoginError('Incorrect email or password');
  });

  /** Negative: empty email should not submit */
  test('empty email prevents submission', async ({ page }) => {
    await loginPage.login('', VALID_USER.password);
    // Should stay on login page (HTML5 validation prevents submit)
    await expect(page).toHaveURL(/\\/login/);
  });

  /** Security: SQL injection attempt should fail safely */
  test('SQL injection in email returns safe error', async () => {
    await loginPage.login(
      INVALID_CREDENTIALS.sqlInjection.email,
      INVALID_CREDENTIALS.sqlInjection.password,
    );
    await loginPage.expectLoginError();
    // Must not show SQL error or stack trace
  });
});`,
        },
        {
          filename: 'playwright.config.ts',
          description: 'Playwright configuration — parallel workers, retries on CI, artifacts on failure',
          fileType: 'config',
          code: `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});`,
        },
      ],
      packageJson: {
        scripts: {
          test: 'playwright test',
          'test:headed': 'playwright test --headed',
          'test:debug': 'playwright test --debug',
          'test:ui': 'playwright test --ui',
          'test:report': 'playwright show-report',
        },
        devDependencies: {
          '@playwright/test': '^1.48.0',
          'typescript': '^5.3.0',
        },
      },
      setupInstructions: [
        'npm install',
        'npx playwright install --with-deps',
        'cp .env.example .env.local  # Set BASE_URL',
        'npx playwright test  # Run all tests',
      ],
      runCommand: 'npx playwright test',
      debugCommand: 'npx playwright test --debug',
    });
  }
  if (systemPrompt.includes('principal QA coverage analyst') || systemPrompt.includes('coverage expert')) {
    return JSON.stringify({
      analysis: {
        existingCoverage: 'Current tests cover the basic happy path for login (valid credentials, redirect, remember me) and one negative case (wrong password). No boundary testing, no security testing, no accessibility testing, and no state transition coverage (e.g., locked account, expired session).',
        coverageBreakdown: { requirements: 60, positivePath: 80, negative: 15, edgeCase: 5, security: 0, performance: 0, accessibility: 0 },
        currentScore: 35,
        projectedScore: 78,
        gaps: ['No boundary value testing (password length limits, email format limits)', 'No security testing (XSS, SQL injection, brute force)', 'No accessibility testing (keyboard nav, screen reader)', 'No state transition coverage (locked → unlocked, session expired)', 'No concurrent session testing', 'Missing error message validation for each failure type'],
      },
      gapAnalysis: [
        { gapId: 'GAP-001', category: 'technique', description: 'No Boundary Value Analysis applied — password min/max length, email format boundaries not tested', riskLevel: 'High', affectedArea: 'Login Form Validation', missingTechnique: 'BVA', impact: 'Users could set 1-character passwords or bypass length validation' },
        { gapId: 'GAP-002', category: 'negative', description: 'Account lockout after failed attempts not tested — no test verifies lockout trigger, duration, or unlock', riskLevel: 'High', affectedArea: 'Authentication Security', missingTechnique: 'ST', impact: 'Brute force attacks could succeed if lockout is broken' },
        { gapId: 'GAP-003', category: 'non_functional', description: 'No XSS or SQL injection testing on login fields', riskLevel: 'High', affectedArea: 'Login Form', missingTechnique: 'EG', impact: 'Injection vulnerabilities could expose user data or allow unauthorized access' },
        { gapId: 'GAP-004', category: 'technique', description: 'No Equivalence Partitioning — valid/invalid email classes not systematically tested', riskLevel: 'Medium', affectedArea: 'Email Validation', missingTechnique: 'EP', impact: 'Edge-case email formats (plus addressing, subdomains) might fail silently' },
        { gapId: 'GAP-005', category: 'non_functional', description: 'No keyboard navigation or screen reader testing for login form', riskLevel: 'Medium', affectedArea: 'Login Page Accessibility', missingTechnique: 'N/A', impact: 'Login page may be inaccessible to users with disabilities (WCAG violation)' },
        { gapId: 'GAP-006', category: 'risk', description: 'No concurrent session testing — what happens when user logs in from two devices', riskLevel: 'Medium', affectedArea: 'Session Management', missingTechnique: 'ST', impact: 'Session conflicts could cause data corruption or security issues' },
      ],
      coverageHeatMap: [
        { module: 'Login Form UI', currentCoverage: 60, projectedCoverage: 90, gapCount: 2, riskLevel: 'Medium' },
        { module: 'Authentication Logic', currentCoverage: 40, projectedCoverage: 85, gapCount: 3, riskLevel: 'High' },
        { module: 'Session Management', currentCoverage: 20, projectedCoverage: 70, gapCount: 2, riskLevel: 'High' },
        { module: 'Security', currentCoverage: 0, projectedCoverage: 60, gapCount: 2, riskLevel: 'High' },
        { module: 'Accessibility', currentCoverage: 0, projectedCoverage: 50, gapCount: 1, riskLevel: 'Medium' },
      ],
      newTestCases: [
        {
          category: 'edge_case', title: 'Login with minimum valid password (exactly 8 characters)',
          description: 'Verify the system accepts the shortest valid password at the exact boundary',
          closesGap: 'GAP-001', testDesignTechnique: 'BVA',
          steps: ['Navigate to /login', 'Enter valid email: test@company.com', 'Enter 8-character password: Abcde1!x', 'Click Sign In'],
          expectedResult: 'Login succeeds — user redirected to /dashboard',
          priority: 'P1', priorityJustification: 'P1 because boundary values are the most common source of off-by-one validation bugs',
          coverageImprovement: '+4%', effortMinutes: 15,
          whyNeeded: 'Password validation might reject exactly-8-char passwords (off-by-one: checking > 8 instead of >= 8)',
        },
        {
          category: 'negative', title: 'Account locks after 5 consecutive failed login attempts',
          description: 'Verify brute force protection by testing the lockout threshold and duration',
          closesGap: 'GAP-002', testDesignTechnique: 'ST',
          steps: ['Navigate to /login', 'Enter valid email: test@company.com', 'Enter wrong password 5 times consecutively', 'Verify account locked message on 5th attempt', 'Wait 15 minutes (or mock time)', 'Attempt login with correct password'],
          expectedResult: 'Account locked after attempt 5, unlocked after 15 minutes, correct password works after unlock',
          priority: 'P0', priorityJustification: 'P0 because broken lockout = brute force vulnerability, which is a critical security control',
          coverageImprovement: '+6%', effortMinutes: 25,
          whyNeeded: 'Without this test, attackers could brute-force passwords indefinitely if lockout is broken',
        },
        {
          category: 'security', title: 'SQL injection in email field returns safe error',
          description: 'Verify the login form safely handles SQL injection payloads without exposing database errors',
          closesGap: 'GAP-003', testDesignTechnique: 'EG',
          steps: ["Navigate to /login", "Enter email: ' OR '1'='1'; DROP TABLE users; --", "Enter any password", "Click Sign In"],
          expectedResult: 'Returns 400 or 401 error. No SQL error in response. No data leaked. Application remains functional.',
          priority: 'P0', priorityJustification: 'P0 because SQL injection is OWASP Top 1 — successful injection could expose entire user database',
          coverageImprovement: '+5%', effortMinutes: 15,
          whyNeeded: 'Even with ORM, misconfigured raw queries could expose SQL injection. This is a baseline security test.',
        },
        {
          category: 'edge_case', title: 'Login with plus-addressed email (user+tag@domain.com)',
          description: 'Verify the system accepts RFC 5322 compliant plus addressing in email field',
          closesGap: 'GAP-004', testDesignTechnique: 'EP',
          steps: ['Navigate to /login', 'Enter email: user+test@company.com', 'Enter valid password', 'Click Sign In'],
          expectedResult: 'Login succeeds if account exists, or shows "Invalid credentials" (not "Invalid email format")',
          priority: 'P2', priorityJustification: 'P2 because plus addressing is valid RFC 5322 but commonly rejected — affects power users',
          coverageImprovement: '+2%', effortMinutes: 10,
          whyNeeded: 'Some email validation rejects + character, blocking legitimate users who use plus addressing for filtering',
        },
        {
          category: 'accessibility', title: 'Login form is fully keyboard navigable',
          description: 'Verify all login form elements can be reached and activated using only the keyboard',
          closesGap: 'GAP-005', testDesignTechnique: 'EG',
          steps: ['Navigate to /login', 'Press Tab — verify focus moves to Email field with visible focus ring', 'Press Tab — verify focus moves to Password field', 'Press Tab — verify focus moves to Sign In button', 'Press Enter on Sign In — verify form submits', 'Verify no focus traps exist'],
          expectedResult: 'All elements reachable via Tab. Focus ring visible on each. Enter activates Sign In. No focus traps.',
          priority: 'P1', priorityJustification: 'P1 because keyboard-only users (motor disabilities) are completely blocked if form is not navigable',
          coverageImprovement: '+4%', effortMinutes: 20,
          whyNeeded: 'Login is the first interaction — if inaccessible, disabled users cannot use the application at all',
        },
        {
          category: 'negative', title: 'Concurrent login from two devices invalidates first session',
          description: 'Verify session management when a user logs in from a second device',
          closesGap: 'GAP-006', testDesignTechnique: 'ST',
          steps: ['Login from Device A (browser 1)', 'Verify session active on Device A', 'Login from Device B (browser 2) with same credentials', 'Return to Device A and perform an action', 'Verify Device A session is invalidated or still valid (document which behavior)'],
          expectedResult: 'Either: (a) Device A session invalidated with redirect to /login, or (b) both sessions active. Behavior must be consistent and documented.',
          priority: 'P2', priorityJustification: 'P2 because concurrent session behavior must be intentional, not accidental — security implications either way',
          coverageImprovement: '+3%', effortMinutes: 25,
          whyNeeded: 'Undefined concurrent session behavior could allow attackers to maintain persistent access after password change',
        },
      ],
      prioritizedOrder: [
        'Account lockout (+6%, 25min, P0)',
        'SQL injection (+5%, 15min, P0)',
        'Password boundary (+4%, 15min, P1)',
        'Keyboard navigation (+4%, 20min, P1)',
        'Concurrent sessions (+3%, 25min, P2)',
        'Plus-addressed email (+2%, 10min, P2)',
      ],
      resourceEstimate: { totalNewTests: 6, totalDesignHours: 2, totalExecutionHours: 1.5, totalAutomationHours: 3 },
      coverageImprovement: '+43%',
      executiveSummary: 'Current test suite covers 35% — primarily happy path with one negative case. Critical gaps in security (0%), accessibility (0%), and state transition testing. Adding 6 prioritized test cases would raise coverage to 78%. Highest priority: account lockout (P0) and SQL injection (P0) — both represent critical security controls with zero current coverage.',
    });
  }

  if (systemPrompt.includes('QA Director') || systemPrompt.includes('QA Lead') || systemPrompt.includes('QA Manager') || systemPrompt.includes('QA Process Lead') || systemPrompt.includes('QA Analytics Lead') || systemPrompt.includes('QA Risk Manager') || systemPrompt.includes('QA Infrastructure') || systemPrompt.includes('DevOps/QA') || systemPrompt.includes('Business Analyst')) {
    // Determine doc type from prompt keywords
    let mockType = 'test_strategy';
    let mockTitle = 'Test Strategy Document';
    if (systemPrompt.includes('TEST SUMMARY REPORT')) { mockType = 'test_summary'; mockTitle = 'Test Summary Report — Release v3.0'; }
    else if (systemPrompt.includes('TRACEABILITY MATRIX')) { mockType = 'traceability_matrix'; mockTitle = 'Requirements Traceability Matrix'; }
    else if (systemPrompt.includes('TEST CLOSURE REPORT')) { mockType = 'test_closure'; mockTitle = 'Test Closure Report — Release v3.0'; }
    else if (systemPrompt.includes('DEFECT ANALYSIS REPORT')) { mockType = 'defect_report'; mockTitle = 'Defect Analysis Report — Sprint 24'; }
    else if (systemPrompt.includes('ENVIRONMENT SETUP')) { mockType = 'test_environment'; mockTitle = 'Test Environment Setup Document'; }
    else if (systemPrompt.includes('PROCESS CHECKLIST')) { mockType = 'qa_checklist'; mockTitle = 'QA Process Checklist'; }
    else if (systemPrompt.includes('EXECUTION REPORT')) { mockType = 'test_execution_report'; mockTitle = 'Test Execution Report — Sprint 24'; }
    else if (systemPrompt.includes('UAT SIGN-OFF')) { mockType = 'uat_signoff'; mockTitle = 'UAT Sign-off Document — Release v3.0'; }
    else if (systemPrompt.includes('RISK ASSESSMENT MATRIX')) { mockType = 'risk_assessment'; mockTitle = 'Risk Assessment Matrix'; }

    const dateStr = new Date().toISOString().split('T')[0];
    const mockTables: Record<string, Array<{title: string; headers: string[]; rows: string[][]}>> = {
      test_strategy: [
        { title: 'Version History', headers: ['Version', 'Date', 'Author', 'Change Description'], rows: [['1.0', dateStr, 'QA Lead', 'Initial draft']] },
        { title: 'Test Levels Matrix', headers: ['Level', 'Description', 'Owner', 'Entry Criteria', 'Exit Criteria', 'Tools'], rows: [['Unit', 'Component logic', 'Developer', 'Code complete', '80% coverage', 'Jest/Vitest'], ['Integration', 'API contracts', 'QA Engineer', 'Unit tests pass', 'All endpoints verified', 'Postman/Supertest'], ['System', 'End-to-end flows', 'QA Lead', 'Integration pass', 'All P0/P1 pass', 'Playwright'], ['UAT', 'Business validation', 'Business Analyst', 'System test pass', 'Business sign-off', 'Manual']] },
        { title: 'Risk Matrix', headers: ['Risk ID', 'Description', 'Probability', 'Impact', 'Score', 'Mitigation', 'Owner'], rows: [['R-001', 'Payment gateway integration', 'High', 'Critical', '20', 'Mock service + sandbox testing', 'QA Lead'], ['R-002', 'Data migration from v2', 'Medium', 'High', '12', 'Migration dry run in staging', 'DBA']] },
        { title: 'RACI Matrix', headers: ['Activity', 'QA Lead', 'QA Engineer', 'Dev Lead', 'Developer', 'PM'], rows: [['Test Planning', 'A', 'C', 'C', 'I', 'R'], ['Test Design', 'R', 'A', 'C', 'I', 'I'], ['Test Execution', 'A', 'R', 'I', 'C', 'I'], ['Defect Triage', 'A', 'R', 'R', 'C', 'I'], ['Sign-off', 'R', 'I', 'R', 'I', 'A']] },
      ],
      test_summary: [
        { title: 'Version History', headers: ['Version', 'Date', 'Author', 'Change Description'], rows: [['1.0', dateStr, 'QA Lead', 'Initial report']] },
        { title: 'Test Execution Summary', headers: ['Test Suite', 'Planned', 'Executed', 'Passed', 'Failed', 'Blocked', 'Pass Rate %'], rows: [['Smoke', '15', '15', '14', '1', '0', '93.3%'], ['Functional', '120', '118', '108', '7', '3', '91.5%'], ['Regression', '85', '85', '82', '2', '1', '96.5%'], ['Integration', '45', '42', '40', '2', '0', '95.2%']] },
        { title: 'Defect Summary by Severity', headers: ['Severity', 'Found', 'Fixed', 'Open', 'Deferred'], rows: [['Critical', '2', '2', '0', '0'], ['High', '5', '4', '1', '0'], ['Medium', '12', '8', '2', '2'], ['Low', '8', '5', '1', '2']] },
        { title: 'Go/No-Go Decision', headers: ['Criteria', 'Target', 'Actual', 'Status'], rows: [['Pass Rate', '>95%', '93.8%', 'CONDITIONAL'], ['Critical Defects Open', '0', '0', 'MET'], ['High Defects Open', '0', '1', 'RISK ACCEPTED'], ['Regression Pass Rate', '>98%', '96.5%', 'CONDITIONAL']] },
      ],
      traceability_matrix: [
        { title: 'Version History', headers: ['Version', 'Date', 'Author', 'Change Description'], rows: [['1.0', dateStr, 'QA Lead', 'Initial RTM']] },
        { title: 'Forward Traceability', headers: ['Req ID', 'Requirement', 'Priority', 'Test Case IDs', 'Status', 'Defect IDs', 'Coverage'], rows: [['REQ-001', 'User login with email/password', 'P0', 'TC-001, TC-002, TC-003', 'Pass', '-', 'Covered'], ['REQ-002', 'SSO integration', 'P1', 'TC-010, TC-011', 'Fail', 'BUG-045', 'Partial'], ['REQ-003', 'Password reset flow', 'P1', '-', 'Not Run', '-', 'NOT COVERED']] },
        { title: 'Coverage Heat Map', headers: ['Module', 'Requirements', 'Covered', 'Partial', 'Not Covered', 'Coverage %', 'RAG'], rows: [['Authentication', '8', '6', '1', '1', '75%', 'Amber'], ['Payments', '12', '10', '2', '0', '83%', 'Amber'], ['Dashboard', '5', '5', '0', '0', '100%', 'Green']] },
      ],
    };

    const tables = mockTables[mockType] ?? mockTables.test_strategy;

    // Doc-type-specific sections
    const mockSections: Record<string, Array<{heading: string; content: string; subsections: Array<{heading: string; content: string}>}>> = {
      test_strategy: [
        { heading: '1. Executive Summary', content: `This Test Strategy Document has been prepared for [Project Name] by the QA team at [Company Name]. It defines the strategic approach to testing across all quality levels.`, subsections: [{ heading: '1.1 Purpose', content: 'Define the testing approach, scope, levels, and objectives for the project.' }] },
        { heading: '2. Test Objectives', content: 'Achieve >95% requirements coverage, <5% defect leakage to production, >80% automation rate for regression.', subsections: [] },
        { heading: '3. Scope', content: 'All modules are in scope.', subsections: [{ heading: '3.1 In Scope', content: 'User Auth, Product Catalog, Cart, Checkout, Payment, Orders, Admin Panel' }, { heading: '3.2 Out of Scope', content: 'Third-party payment provider internal testing, legacy v1 system' }] },
        { heading: '4. Automation Strategy', content: 'Target 80% automation for regression suite. Tool: Playwright for E2E, Jest for unit. ROI target: 3x within 6 months.', subsections: [] },
      ],
      test_summary: [
        { heading: '1. Report Identifier', content: `Report ID: TSR-2026-001 | Release: v3.0.0 | Sprint: 24 | Period: Mar 1-14, 2026`, subsections: [] },
        { heading: '2. Executive Summary', content: 'Testing of Release v3.0.0 is complete. 265 test cases executed with 93.8% pass rate. 27 defects found (2 Critical, 5 High). Recommendation: CONDITIONAL GO with 1 open High defect risk-accepted.', subsections: [] },
        { heading: '3. Test Objective vs Achievement', content: 'See table below for objective-by-objective comparison.', subsections: [] },
        { heading: '4. Go/No-Go Recommendation', content: 'CONDITIONAL GO — All critical defects resolved. One High defect (BUG-891) open with workaround available and risk accepted by Product Owner.', subsections: [] },
      ],
      traceability_matrix: [
        { heading: '1. Traceability Overview', content: 'This RTM maps all requirements to test cases for [Project Name] v3.0.0. Overall coverage: 85%. P0 coverage: 100%. P1 coverage: 88%.', subsections: [] },
        { heading: '2. Gap Analysis', content: 'REQ-003 (Password reset flow) has NO test coverage. Risk: High — password reset is a critical account recovery path.', subsections: [] },
        { heading: '3. Coverage Improvement Plan', content: '1. Add test cases for REQ-003 (Priority: Immediate, Owner: QA1). 2. Complete partial coverage for REQ-002 SSO edge cases.', subsections: [] },
      ],
      test_closure: [
        { heading: '1. Project Summary', content: 'Project: [Project Name] v3.0.0 | Test Period: Mar 1-28, 2026 | Team: 2 QA Engineers, 1 QA Lead | Effort: 45 person-days', subsections: [] },
        { heading: '2. Quality KPIs', content: 'DRE: 94.7% (target: 95% — PARTIAL). Defect Leakage: 5.3% (3 production bugs in first week). Test Coverage: 87% (target: 85% — MET).', subsections: [] },
        { heading: '3. Formal Sign-off', content: 'See sign-off table below. All stakeholders approved with conditions.', subsections: [] },
      ],
      defect_report: [
        { heading: '1. Defect Overview', content: 'Total defects this release: 47. Critical: 3 (6.4%), High: 9 (19.1%), Medium: 22 (46.8%), Low: 13 (27.7%). Trend: 15% reduction from previous release.', subsections: [] },
        { heading: '2. Root Cause Analysis', content: 'Top root cause: Coding Errors (51%). Second: Requirements Gaps (23%). Third: Integration Issues (12%).', subsections: [] },
        { heading: '3. Pareto Analysis', content: 'Authentication module accounts for 34% of all defects. Combined with Payments (21%), these two modules represent 55% of all bugs (top 20% of modules = 80% of defects — Pareto confirmed).', subsections: [] },
      ],
    };

    const sections = mockSections[mockType] ?? mockSections.test_strategy;

    return JSON.stringify({
      document: { title: mockTitle, type: mockType, version: '1.0', author: 'QA Team', date: dateStr, status: 'Draft' },
      sections,
      tables,
      markdownOutput: `# ${mockTitle}\n\n**[Company Name]** | **[Project Name]**\n\n| Version | Date | Author | Change Description |\n|---------|------|--------|-------------------|\n| 1.0 | ${dateStr} | QA Lead | Initial draft |\n\n---\n\n${sections.map(s => `## ${s.heading}\n\n${s.content}\n${s.subsections.map(ss => `### ${ss.heading}\n\n${ss.content}`).join('\n\n')}`).join('\n\n---\n\n')}\n\n---\n\n## Document Approval\n\n| Role | Name | Signature | Date |\n|------|------|-----------|------|\n| QA Lead | ____________ | ____________ | ____________ |\n| Dev Lead | ____________ | ____________ | ____________ |\n| Product Owner | ____________ | ____________ | ____________ |`,
      summary: `Enterprise-grade ${mockTitle.toLowerCase()} with comprehensive metrics, tables, and sign-off sections`,
    });
  }

  // Default bug analysis — enterprise-grade mock
  const yr = new Date().getFullYear();
  return JSON.stringify({
    defectId: `BUG-${yr}-0001`,
    title: 'Authentication - SSO OAuth Callback - Unhandled TypeError Causes White Screen',
    description: 'Users attempting to sign in via enterprise SSO encounter an unhandled TypeError in the OAuth callback handler, resulting in a white screen. The application fails to destructure the identity provider response when the token payload format deviates from the expected schema.',
    severity: 'HIGH',
    severityJustification: 'Major feature (SSO login) is completely broken for enterprise users (~35% of user base). No inline workaround — users must use email/password fallback which many enterprise accounts do not have configured. No data loss, but complete workflow blockage for affected segment.',
    priority: 'P1',
    priorityJustification: 'Enterprise SSO is a contractual requirement for several key accounts. Blocking SSO blocks enterprise onboarding. Fix required in current sprint to prevent SLA violation on enterprise support agreements.',
    classification: {
      defectType: 'Integration',
      reproducibility: 'Always',
      reproductionNotes: 'Reproduces 100% of the time with any enterprise SSO provider (Okta, Azure AD). Does NOT reproduce with Google OAuth or email/password login.',
    },
    stepsToReproduce: [
      'Navigate to /login on production (v2.4.1)',
      'Click "Sign in with SSO" button',
      'Complete authentication with enterprise IdP (Okta tested)',
      'Observe: browser redirects to /api/auth/callback/sso',
      'Result: white screen with TypeError in browser console',
    ],
    expectedResult: 'User is authenticated and redirected to /dashboard with a valid session',
    actualResult: 'White screen. Browser console shows: TypeError: Cannot read properties of undefined (reading \'email\'). No error boundary catches the exception. Network tab shows 200 from IdP but the app crashes before setting session.',
    environment: {
      os: 'Windows 11',
      browser: 'Chrome 120.0.6099.130',
      version: 'v2.4.1',
      device: 'Desktop',
      network: 'Corporate network (no proxy issues — IdP callback returns 200)',
      additionalContext: 'Also reproduced on Firefox 121 and Edge 120. NOT reproduced on mobile app v2.4.0.',
    },
    rootCauseAnalysis: [
      {
        hypothesis: 'OAuth token response schema changed after IdP update — the callback handler expects `response.user.email` but the new payload nests it under `response.claims.email_verified` or `response.profile.email`',
        confidence: 75,
        affectedArea: 'lib/auth/authOptions.ts → signIn callback → OAuth user upsert',
        investigationSteps: [
          'Log the raw OAuth token response from the IdP callback in staging',
          'Compare against the expected schema in authOptions.ts signIn callback',
          'Check if the IdP (Okta) released a breaking change in their token format',
          'Review git blame on the signIn callback for recent changes',
        ],
        rootCauseCategory: 'Integration Error',
      },
      {
        hypothesis: 'Race condition between token validation and session creation — the async upsert completes after the redirect, leaving session.user undefined',
        confidence: 40,
        affectedArea: 'lib/auth/authOptions.ts → jwt callback',
        investigationSteps: [
          'Add timing logs to the signIn, jwt, and session callbacks',
          'Check if the issue is timing-dependent by adding artificial delay',
          'Test with a synchronous user lookup instead of async upsert',
        ],
        rootCauseCategory: 'Coding Error',
      },
      {
        hypothesis: 'Missing null-safety check — the jwt callback queries user by `token.email` which may be undefined for SSO providers that return a different claim format',
        confidence: 60,
        affectedArea: 'lib/auth/authOptions.ts → jwt callback, line ~94 (token.email! non-null assertion)',
        investigationSteps: [
          'Check if token.email is populated after the signIn callback for SSO users',
          'Test with a breakpoint in the jwt callback to inspect the token object',
          'Verify the User table has the correct email for the SSO user',
        ],
        rootCauseCategory: 'Coding Error',
      },
    ],
    impactRadius: {
      affectedUserSegments: 'Enterprise SSO users — approximately 35% of total user base (all users on Okta, Azure AD, or SAML-based IdPs)',
      affectedFeatures: {
        primary: ['SSO Authentication', 'Enterprise Login Flow'],
        downstream: ['Session Management', 'Role-based Access Control', 'Organization auto-provisioning', 'Audit logging for SSO events'],
      },
      businessImpact: 'Blocks enterprise onboarding flow entirely. Three enterprise pilot accounts (est. $45K ARR combined) are unable to complete setup. Support ticket volume for SSO issues increased 400% since v2.4.1 deployment.',
      dataIntegrityRisk: 'Low — the crash occurs before any data write. No user records are created or modified. Session tokens are not issued. However, partial OAuth state may be stored in cookies, requiring users to clear cookies before retrying.',
    },
    recommendedFix: {
      approach: 'Add defensive null checks in the signIn callback before accessing user.email. Normalize the OAuth response to extract email from multiple possible claim paths (user.email, user.profile.email, user.claims.email). Add a schema validation layer for OAuth responses using zod.',
      estimatedEffort: '4-6 hours — includes fix, unit tests for OAuth response parsing, and integration test with mock IdP responses',
      workaround: 'Affected users can sign in using email/password if their account has a password configured. For accounts without passwords, an admin can temporarily set one via the database. This is not a scalable workaround for enterprise accounts.',
      regressionRisk: 'Modifying the signIn callback affects ALL OAuth providers (GitHub, Google, SSO). Incorrect changes could break non-SSO OAuth login. The jwt callback change could affect token refresh for existing sessions.',
    },
    testingRecommendations: {
      newTestCases: [
        'SSO login with standard Okta token response → should authenticate successfully',
        'SSO login with Azure AD token response (different claim structure) → should authenticate successfully',
        'SSO login with missing email claim → should show friendly error, not crash',
        'SSO login with null/undefined user properties → should fail gracefully',
        'OAuth callback with malformed JSON response → should redirect to /login with error',
      ],
      regressionScope: 'Full authentication test suite: email/password login, GitHub OAuth, Google OAuth, session persistence, token refresh, logout flow',
      verificationApproach: 'Deploy fix to staging → test with real Okta sandbox → monitor error tracking (Sentry) for 24h → promote to production with feature flag',
    },
    triageRecommendation: {
      owningTeam: 'Platform / Authentication team',
      sprintRecommendation: 'Current sprint — this is blocking enterprise customer onboarding',
      sla: 'High severity: 1 business day response, fix within current sprint',
    },
    negativeSpace: {
      workingFeatures: [
        'Email/password authentication works correctly',
        'GitHub OAuth login works correctly',
        'Google OAuth login works correctly',
        'Session management works after successful authentication (any method)',
        'Password reset flow is unaffected',
        'API authentication via bearer tokens works correctly',
        'Mobile app v2.4.0 SSO works (uses a different OAuth flow)',
      ],
      nonReproducingConditions: [
        'Does NOT reproduce with Google or GitHub OAuth — only enterprise SSO providers',
        'Does NOT reproduce on mobile app v2.4.0 (uses native OAuth, different callback path)',
        'Did NOT occur on v2.3.x — regression introduced in v2.4.1',
      ],
    },
    affectedModules: ['Authentication', 'Session Management', 'OAuth Integration'],
    tags: ['sso', 'crash', 'auth', 'oauth', 'enterprise', 'regression', 'p1'],
    confidence: 0.78,
    clarificationNeeded: [
      'Which specific IdP is affected? (Okta, Azure AD, SAML, all of them?)',
      'Was there a recent IdP configuration change or update on the customer side?',
      'What version was working previously? (confirms regression window)',
      'Are there any relevant entries in server-side logs or Sentry?',
    ],
    // Backward compatibility fields
    technicalAnalysis: {
      summary: 'OAuth callback handler throws unhandled TypeError when destructuring SSO identity provider response. The token payload schema appears to have changed, causing user.email to be undefined.',
      technicalDetails: 'The signIn callback in authOptions.ts uses user.email! (non-null assertion) to upsert the user record. For SSO providers that return email under a different claim path, this throws TypeError: Cannot read properties of undefined. The error is not caught by any error boundary, resulting in a white screen.',
      suggestedFix: 'Add null-safe email extraction from multiple OAuth claim paths. Add zod schema validation for OAuth responses. Wrap the signIn callback in try-catch with fallback redirect to /login?error=OAuthCallback.',
      relatedAreas: ['Token refresh', 'Session serialization', 'Role-based access control'],
      confidence: 0.78,
    },
    impactPrediction: {
      userImpact: 'HIGH',
      affectedModules: ['Authentication', 'Session Management', 'OAuth Integration'],
      estimatedUsersImpacted: 'Enterprise SSO users — ~35% of user base',
      businessImpact: 'Blocks enterprise onboarding. Three pilot accounts ($45K ARR combined) unable to complete setup. 400% increase in SSO-related support tickets.',
      testCoverageSuggestions: ['SSO login with varied IdP response schemas', 'OAuth callback error handling', 'Missing/null claim handling'],
    },
  });
}

function getMockChatResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('why') || lower.includes('cause')) {
    return "Based on the analysis, this issue likely stems from **insufficient error handling in the OAuth callback flow**. When the identity provider's response format changes, the code attempts to destructure properties that don't exist.\n\nKey investigation areas:\n1. Check the OAuth response schema against expected format\n2. Review recent IdP updates\n3. Look for missing defensive coding patterns";
  }
  if (lower.includes('test') || lower.includes('coverage')) {
    return "I'd recommend:\n\n**Unit Tests:** Token parsing with valid/invalid/empty responses\n\n**Integration Tests:** Full SSO flow with mock IdP, token refresh scenarios\n\n**E2E Tests:** Happy path SSO login, network interruption during OAuth, expired token handling";
  }
  return "Based on the analysis, the core issue is in the OAuth integration layer. The crash occurs because the app doesn't handle unexpected response formats gracefully.\n\nWould you like me to dig deeper into the root cause, testing strategy, or fix implementation?";
}
