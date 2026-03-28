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
// 2. QUALITY SCORE (existing)
// ═══════════════════════════════════════════════════════════════
export async function calculateQualityScore(bugReport: Record<string, unknown>) {
  const systemPrompt = `You are a QA quality evaluator. Score the bug report on a 0-100 scale.
Return ONLY valid JSON:
{
  "score": 85,
  "breakdown": { "clarity": 90, "reproducibility": 80, "completeness": 85, "technicalDetail": 80, "actionability": 90 },
  "suggestions": ["Suggestion to improve the report"]
}`;

  const response = await callAI(systemPrompt, JSON.stringify(bugReport));
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 3. DUPLICATE DETECTION (existing)
// ═══════════════════════════════════════════════════════════════
export async function detectDuplicates(newBug: { title: string; description: string }, existingBugs: { id: string; title: string; description: string }[]) {
  if (existingBugs.length === 0) return [];

  const systemPrompt = `You are a duplicate bug detector. Compare the new bug against existing bugs.
Return ONLY valid JSON:
{ "duplicates": [{ "id": "existing_bug_id", "similarity": 0.92, "reason": "Why duplicates" }] }
Only include bugs with similarity > 0.6. Return empty array if no duplicates.`;

  const userMessage = `New Bug:\nTitle: ${newBug.title}\nDescription: ${newBug.description}\n\nExisting Bugs:\n${existingBugs.map((b) => `ID: ${b.id} | Title: ${b.title} | Desc: ${b.description}`).join('\n')}`;
  const response = await callAI(systemPrompt, userMessage);
  const result = extractJSON(response);
  return (result.duplicates as Array<{ id: string; similarity: number; reason: string }>) || [];
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
// 7. API TEST SCRIPT GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateAPITests(apiDescription: string, format: 'postman' | 'curl' | 'playwright' | 'cypress' | 'jest' | 'supertest') {
  const formatInstructions: Record<string, string> = {
    postman: 'Postman collection JSON format (v2.1) with pre-request scripts and tests',
    curl: 'cURL commands with headers, body, and expected response comments',
    playwright: 'Playwright API testing code using request context (TypeScript)',
    cypress: 'Cypress API testing code with cy.request (TypeScript)',
    jest: 'Jest + Supertest API testing code (TypeScript)',
    supertest: 'Supertest standalone API testing code (TypeScript)',
  };

  const systemPrompt = `You are an API test automation expert. Generate comprehensive API test scripts.

Given an API endpoint description, generate test scripts in ${formatInstructions[format]} format.

Cover these scenarios:
- Happy path (valid request, correct response)
- Authentication (missing/invalid/expired tokens)
- Validation (missing fields, wrong types, boundary values)
- Error handling (404, 500, timeout)
- Edge cases (empty body, large payload, special characters)

Return ONLY valid JSON:
{
  "endpoint": {
    "method": "GET|POST|PUT|DELETE|PATCH",
    "path": "/api/example",
    "description": "What this endpoint does"
  },
  "testScripts": [
    {
      "name": "Test name",
      "description": "What this test checks",
      "category": "happy_path|auth|validation|error|edge_case",
      "code": "// the actual test code"
    }
  ],
  "setupCode": "// any setup/teardown code needed",
  "envVariables": { "BASE_URL": "http://localhost:3000", "AUTH_TOKEN": "test-token" },
  "totalTests": 0
}

Generate 6-10 test scripts. Make the code production-ready and copy-pasteable.`;

  const response = await callAI(systemPrompt, `API Description:\n${apiDescription}\n\nFormat: ${format}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 8. RELEASE NOTES GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateReleaseNotes(input: string, format: 'standard' | 'technical' | 'user-facing' | 'changelog' | 'slack') {
  const systemPrompt = `You are a technical writer who creates clear, professional release notes.

Given a list of changes, bug fixes, Jira tickets, or commit messages, generate well-structured release notes.

Format style: ${format}
- standard: Professional release notes with sections
- technical: Detailed technical changelog for developers
- user-facing: Simple, non-technical notes for end users
- changelog: CHANGELOG.md format (Keep a Changelog standard)
- slack: Short Slack announcement format with emojis

Return ONLY valid JSON:
{
  "version": "Suggested version number",
  "date": "Release date",
  "title": "Release title",
  "summary": "One-line summary of this release",
  "sections": {
    "newFeatures": [{ "title": "Feature title", "description": "What it does", "ticket": "JIRA-123" }],
    "improvements": [{ "title": "", "description": "", "ticket": "" }],
    "bugFixes": [{ "title": "", "description": "", "ticket": "", "severity": "critical|high|medium|low" }],
    "breakingChanges": [{ "title": "", "description": "", "migration": "Migration steps if needed" }],
    "knownIssues": [{ "title": "", "description": "", "workaround": "" }]
  },
  "markdownOutput": "The complete release notes in markdown format",
  "slackOutput": "Short slack-friendly version"
}`;

  const response = await callAI(systemPrompt, `Input (tickets/commits/changes):\n${input}\n\nFormat: ${format}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 9. TEST DATA GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateTestData(scenario: string, options: { count: number; format: 'json' | 'csv' | 'sql' | 'typescript'; includeEdgeCases: boolean; locale?: string }) {
  const systemPrompt = `You are a test data engineering expert. Generate realistic, diverse test data.

Given a scenario description, generate test data that includes:
- Valid/happy path data
- Boundary values (min, max, empty, null)
${options.includeEdgeCases ? '- Edge cases (unicode, special chars, very long strings, negative numbers, zero, future/past dates)' : ''}
- Invalid data for negative testing
- Realistic names, emails, addresses using ${options.locale || 'en-US'} locale

Output format: ${options.format}
Count: ${options.count} records (plus edge cases)

Return ONLY valid JSON:
{
  "scenario": "What this data is for",
  "schema": {
    "fields": [{ "name": "fieldName", "type": "string|number|email|date|boolean|enum", "constraints": "any validation rules" }]
  },
  "validData": [{}],
  "edgeCaseData": [{ "_note": "why this is an edge case" }],
  "invalidData": [{ "_note": "why this is invalid", "_expectedError": "expected validation error" }],
  "formattedOutput": "The data in the requested format (${options.format})",
  "totalRecords": 0
}

Generate realistic, diverse data that a QA engineer can immediately use.`;

  const response = await callAI(systemPrompt, `Scenario:\n${scenario}\n\nCount: ${options.count}\nFormat: ${options.format}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 10. SPRINT TEST PLAN GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateTestPlan(sprintInfo: string, options: { sprintDuration: number; teamSize: number; includeRegression: boolean; riskLevel: 'low' | 'medium' | 'high' }) {
  const systemPrompt = `You are a QA lead who creates detailed sprint test plans.

Given sprint user stories/tickets, create a comprehensive test plan.

Sprint duration: ${options.sprintDuration} days
QA team size: ${options.teamSize}
Risk level: ${options.riskLevel}
Include regression: ${options.includeRegression}

Return ONLY valid JSON:
{
  "testPlan": {
    "sprintName": "Sprint name",
    "objective": "Testing objective",
    "scope": "What's in and out of scope",
    "riskAssessment": "Overall risk level and reasoning",
    "estimatedHours": 0,
    "startDate": "Day 1 activities",
    "testEnvironments": ["env1"]
  },
  "stories": [
    {
      "storyId": "Story reference",
      "title": "Story title",
      "testCases": [
        { "title": "", "type": "functional|integration|e2e|performance", "priority": "P0|P1|P2|P3", "estimatedMinutes": 30, "assignee": "QA1|QA2" }
      ],
      "riskLevel": "low|medium|high",
      "testDataNeeded": "What test data is required"
    }
  ],
  "regressionSuite": [{ "area": "", "tests": 0, "estimatedMinutes": 0, "priority": "P1|P2" }],
  "schedule": [
    { "day": 1, "activities": ["Activity 1"], "milestone": "" }
  ],
  "entryExitCriteria": {
    "entry": ["Criterion 1"],
    "exit": ["Criterion 1"]
  },
  "risks": [{ "risk": "", "mitigation": "", "probability": "low|medium|high" }],
  "markdownOutput": "Complete test plan in markdown"
}`;

  const response = await callAI(systemPrompt, `Sprint Information:\n${sprintInfo}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 11. AUTOMATION SCRIPT GENERATOR (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function generateAutomationScript(scenario: string, framework: 'playwright' | 'cypress' | 'selenium-js' | 'puppeteer' | 'webdriverio', options: { language: 'typescript' | 'javascript'; includePageObject: boolean; includeHelpers: boolean; includeCIConfig: boolean }) {
  const systemPrompt = `You are a senior test automation engineer. Generate production-ready automation scripts.

Framework: ${framework}
Language: ${options.language}

STRICT CODE QUALITY RULES:
1. Use ONLY real, documented API methods for ${framework}. Do NOT invent methods or parameters.
2. Include proper imports at the top of every file.
3. Use explicit waits instead of arbitrary sleep/delays.
4. Add meaningful error messages to assertions.
5. Use realistic but safe selectors (data-testid preferred, then aria-label, then CSS selectors — never fragile XPath).
6. Include proper setup/teardown (beforeEach/afterEach).
7. Handle common failure scenarios (element not found, timeout, network error).
8. Add JSDoc comments explaining what each test does and why.
9. The code must be copy-paste runnable after installing dependencies — test this mentally before outputting.
10. Never use deprecated APIs. Use the latest stable API for ${framework}.

${framework === 'playwright' ? 'Use @playwright/test, not the older playwright library. Use page.getByRole(), page.getByText(), page.getByTestId() locators.' : ''}
${framework === 'cypress' ? 'Use cy.get(), cy.contains(), cy.intercept() for network stubbing. Use Cypress best practices.' : ''}
${framework === 'selenium-js' ? 'Use selenium-webdriver with Builder pattern. Use By.css() selectors. Add explicit waits with until.' : ''}

Generate a complete, runnable automation test suite that includes:
- Test file with multiple test cases
${options.includePageObject ? '- Page Object Model classes' : ''}
${options.includeHelpers ? '- Helper/utility functions (waits, assertions, data generators)' : ''}
${options.includeCIConfig ? '- CI/CD config (GitHub Actions YAML)' : ''}
- Proper error handling, retries, and waits
- Meaningful assertions
- Test data management
- Clear comments explaining each section

Return ONLY valid JSON:
{
  "framework": "${framework}",
  "language": "${options.language}",
  "files": [
    {
      "filename": "tests/example.spec.ts",
      "description": "What this file does",
      "code": "// complete file content"
    }
  ],
  "packageJson": {
    "scripts": {},
    "devDependencies": {}
  },
  "setupInstructions": ["Step 1 to set up and run"],
  "runCommand": "npx playwright test"
}

Make the code production-quality, well-structured, and immediately runnable.`;

  const response = await callAI(systemPrompt, `Test Scenario:\n${scenario}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 12. COVERAGE EXPANDER (NEW!)
// ═══════════════════════════════════════════════════════════════
export async function expandCoverage(existingTests: string, expansionType: 'edge_cases' | 'negative' | 'security' | 'performance' | 'accessibility' | 'all') {
  const systemPrompt = `You are a QA coverage expert. Given existing test cases, generate ADDITIONAL tests to expand coverage.

Expansion focus: ${expansionType}

Analyze the existing tests and identify gaps, then generate new test cases that cover:
${expansionType === 'edge_cases' || expansionType === 'all' ? '- Edge cases not yet covered (boundaries, nulls, unicode, concurrent ops)' : ''}
${expansionType === 'negative' || expansionType === 'all' ? '- Negative scenarios (invalid inputs, unauthorized, race conditions)' : ''}
${expansionType === 'security' || expansionType === 'all' ? '- Security tests (injection, XSS, CSRF, auth bypass, data leaks)' : ''}
${expansionType === 'performance' || expansionType === 'all' ? '- Performance tests (load, stress, memory, response time)' : ''}
${expansionType === 'accessibility' || expansionType === 'all' ? '- Accessibility tests (WCAG compliance, screen readers, keyboard)' : ''}

Return ONLY valid JSON:
{
  "analysis": {
    "existingCoverage": "What the current tests cover",
    "gaps": ["Gap 1", "Gap 2"],
    "currentScore": 65,
    "projectedScore": 88
  },
  "newTestCases": [
    {
      "category": "edge_case|negative|security|performance|accessibility",
      "title": "Test title",
      "description": "What this test catches",
      "steps": ["Step 1"],
      "expectedResult": "Expected outcome",
      "priority": "P0|P1|P2|P3",
      "whyNeeded": "What bug this could catch"
    }
  ],
  "totalNewTests": 0,
  "coverageImprovement": "+23%"
}`;

  const response = await callAI(systemPrompt, `Existing Tests:\n${existingTests}`);
  return extractJSON(response);
}

// ═══════════════════════════════════════════════════════════════
// 13. QA DOCUMENTATION GENERATOR
// ═══════════════════════════════════════════════════════════════

type QADocType = 'test_strategy' | 'test_summary' | 'traceability_matrix' | 'test_closure' | 'defect_report' | 'test_environment' | 'qa_checklist' | 'test_execution_report' | 'uat_signoff' | 'risk_assessment';

function getDocTypePrompt(docType: QADocType, dateStr: string): string {
  const header = `Use [Company Name] and [Project Name] as placeholders the user can replace.
Include a Version History table at the very top of the markdown (columns: Version, Date, Author, Change Description).
Include a Document Approval / Sign-off section at the bottom (table: Role, Name, Signature, Date).
Use professional markdown tables throughout. The markdownOutput must be copy-paste ready for Confluence or Google Docs.`;

  const prompts: Record<QADocType, string> = {
    test_strategy: `You are a QA Director at a Fortune 500 company creating a TEST STRATEGY DOCUMENT.

${header}

REQUIRED SECTIONS — generate ALL of these with realistic, detailed content:
1. Executive Summary — high-level purpose, project context, strategic testing goals
2. Testing Objectives — SMART objectives tied to business outcomes
3. Scope — In-Scope items table (module, test types, priority) and Out-of-Scope items with justification
4. Test Levels Matrix — table with columns: Test Level (Unit, Component, Integration, System, UAT), Description, Owner, Entry Criteria, Exit Criteria, Tools
5. Test Types — Functional, Non-Functional (Performance, Security, Accessibility, Usability, Compatibility), Regression, Smoke, Sanity — each with description and when applied
6. Tools & Infrastructure — table: Tool, Purpose, License, Owner
7. Environment Strategy — table: Environment (Dev, QA, Staging, Pre-Prod, Prod), Purpose, Refresh Cycle, Data Strategy, Access
8. Risk Matrix — table: Risk ID, Risk Description, Probability (H/M/L), Impact (H/M/L), Risk Score, Mitigation Strategy, Owner
9. RACI Matrix — table: Activity (Test Planning, Test Design, Test Execution, Defect Triage, Sign-off, etc.) vs Roles (QA Lead, QA Engineer, Dev Lead, Developer, PM, BA)
10. Defect Management Workflow — states (New → Assigned → In Progress → Fixed → Verified → Closed / Reopened), SLA by severity, escalation path
11. Entry/Exit Criteria per Test Level — table format
12. Schedule & Milestones — Gantt-style table: Phase, Start, End, Deliverable, Owner
13. Sign-off Section`,

    test_summary: `You are a QA Lead at a Fortune 500 company creating a TEST SUMMARY REPORT.

${header}

REQUIRED SECTIONS — generate ALL with realistic metrics:
1. Release/Sprint Identifier — release name, version, sprint number, date range
2. Test Execution Summary Table — columns: Test Suite, Planned, Executed, Passed, Failed, Blocked, Not Run, Pass Rate %
3. Defect Summary — table by Severity (Critical/High/Medium/Low): Found, Fixed, Open, Deferred, Reopen
4. Defect Summary by Priority — same structure for P0-P4
5. Test Coverage by Module — table: Module, Requirements Count, Test Cases, Executed, Coverage %
6. Environment Details — table: Environment, URL, Version, Database, Notes
7. Deviations from Test Plan — what changed and why
8. Open Defects with Risk Assessment — table: Defect ID, Title, Severity, Impact, Risk if released, Workaround Available (Y/N)
9. Go/No-Go Recommendation — EXPLICIT recommendation with supporting evidence table
10. Lessons Learned — what went well, what didn't, action items
11. Metrics Dashboard — Defect Density (defects/KLOC or per module), Defect Removal Efficiency (DRE), Test Execution Rate (daily/sprint), Defect Discovery Rate over time`,

    traceability_matrix: `You are a QA Manager creating a REQUIREMENTS TRACEABILITY MATRIX (RTM).

${header}

REQUIRED SECTIONS — generate ALL:
1. Forward Traceability Table — columns: Requirement ID, Requirement Title, Priority, Test Case IDs (comma-separated), Test Status (Pass/Fail/Not Run), Defect IDs, Coverage Status
2. Backward Traceability Table — columns: Test Case ID, Test Case Title, Requirement IDs Covered, Execution Status, Last Run Date
3. Coverage Heat Map by Module — table: Module, Total Requirements, Covered, Partial, Not Covered, Coverage %, RAG Status (Red/Amber/Green)
4. Gap Analysis — Requirements without any test coverage, with risk assessment for each
5. Orphaned Test Cases — test cases not linked to any requirement, with recommendation (keep/retire/reassign)
6. Requirements Without Coverage — highlighted list with business impact
7. Traceability Summary — overall coverage %, coverage by priority (P0-P4), coverage trend
8. Coverage Improvement Plan — action items to close gaps`,

    test_closure: `You are a QA Director creating a TEST CLOSURE REPORT for executive sign-off.

${header}

REQUIRED SECTIONS — generate ALL:
1. Project Summary — project name, version, test period, team size, scope
2. Objectives vs Achievements — table: Objective, Target, Actual, Status (Met/Partially Met/Not Met)
3. Quality KPIs — table: KPI, Target, Actual, Status
   - Defect Density (defects per KLOC or per feature)
   - Defect Removal Efficiency (DRE = defects found in testing / total defects)
   - Test Coverage % (by requirements, by code)
   - Defect Leakage Rate (defects found in production / total defects)
4. Test Metrics Summary — total test cases, executed, pass rate, automation rate
5. Defect Analysis — table: Severity, Found, Fixed, Deferred, Open, Reopen; same for Priority
6. Pending Risks with Mitigation — table: Risk, Severity, Mitigation, Owner, Timeline
7. Lessons Learned — categorized: Process, Tools, People, Technical
8. Recommendations for Next Release — prioritized list
9. Formal Sign-off Section — table: Role (QA Lead, Dev Lead, PM, Product Owner, Sponsor), Name, Decision (Approve/Reject/Conditional), Date, Comments`,

    defect_report: `You are a QA Analytics Lead creating a DEFECT ANALYSIS REPORT.

${header}

REQUIRED SECTIONS — generate ALL with realistic sample data:
1. Defect Distribution by Severity — table: Severity, Count, % of Total, Trend vs Last Release
2. Defect Distribution by Priority — table: Priority, Count, % of Total
3. Defect Distribution by Module — table: Module, Total, Critical, High, Medium, Low, % of Total
4. Defect Distribution by Sprint — table: Sprint, Found, Fixed, Reopened, Net Open
5. Defect Discovery vs Resolution Rate — table by week/sprint: Period, Found, Resolved, Cumulative Open
6. Mean Time to Resolution by Severity — table: Severity, Avg Hours to Fix, Min, Max, SLA Target, SLA Met %
7. Root Cause Categorization — table: Root Cause (Code Defect, Requirement Gap, Environment Issue, Test Data, Design Flaw, Configuration, Third-Party), Count, %, Prevention Action
8. Defect Injection Point Analysis — table: Phase Introduced (Requirements, Design, Coding, Integration, Deployment), Count, %, Cost to Fix (relative)
9. Defect Age Analysis — table: Age Bucket (0-1 days, 2-3 days, 4-7 days, 1-2 weeks, 2+ weeks), Count, % — how long defects stay open
10. Pareto Analysis — identify the 20% of modules causing 80% of defects, table format
11. Prevention Recommendations — prioritized action items with expected impact`,

    test_environment: `You are a DevOps/QA Infrastructure Lead creating a TEST ENVIRONMENT SETUP DOCUMENT.

${header}

REQUIRED SECTIONS — generate ALL:
1. Environment Architecture — text description of the environment topology (tiers, load balancers, microservices layout)
2. Hardware/VM Specifications — table: Component, CPU, RAM, Storage, OS, Purpose
3. Software Stack — table: Software, Version, Purpose, License, Installation Notes
4. Network Configuration — VPN requirements, firewall rules, port mappings, DNS entries
5. Database Setup — table: Database, Engine, Version, Size, Refresh Source, Refresh Schedule; include test data seeding requirements
6. Third-Party Service Configurations — table: Service, Purpose, Endpoint, Auth Method, Mock Available (Y/N), Rate Limits
7. Access Credentials Template — table: System, URL, Username Template, Role, Access Request Process (NO real credentials)
8. Environment URLs — table: Environment (Dev, QA, Staging, Pre-Prod, Prod), App URL, API URL, Admin URL, Monitoring URL
9. Setup Steps with Commands — numbered step-by-step with actual CLI commands (git clone, docker-compose, npm install, etc.)
10. Health Check Verification — table: Check, Command/URL, Expected Result, Timeout
11. Troubleshooting Guide — table: Symptom, Likely Cause, Resolution Steps
12. Environment Refresh/Reset Procedures — step-by-step for each environment`,

    qa_checklist: `You are a QA Process Lead creating a QA PROCESS CHECKLIST document.

${header}

REQUIRED SECTIONS — generate ALL as checkbox-style tables with columns: #, Checklist Item, Responsible Role, Status (checkbox placeholder), Notes

1. Sprint QA Checklist
   a. Pre-Sprint: requirements reviewed, acceptance criteria defined, test env ready, test data prepared, automation framework updated
   b. During Sprint: daily smoke tests, test case execution tracking, defect triage attendance, test progress reporting, blocker escalation
   c. End of Sprint: regression suite executed, test summary prepared, defect backlog reviewed, retrospective input, knowledge base updated

2. Release Checklist
   a. Pre-Deploy: all test suites passed, go/no-go meeting held, release notes reviewed, rollback plan documented, monitoring alerts configured
   b. Deploy: deployment steps executed, smoke tests in production, health checks verified, performance baseline captured
   c. Post-Deploy: production verification tests, user-facing feature validation, error rate monitoring (24h), stakeholder notification
   d. Rollback: rollback criteria defined, rollback procedure tested, data migration reversibility confirmed

3. Requirement Review Checklist — testability, acceptance criteria, edge cases identified, dependencies mapped

4. Test Readiness Checklist — test plan approved, test cases reviewed, test data available, environment stable, automation scripts ready

5. UAT Sign-off Checklist — UAT test cases executed, business scenarios validated, user feedback collected, training materials ready, sign-off obtained

6. Production Verification Checklist — critical paths verified, integrations validated, performance acceptable, security scan clear, monitoring active`,

    test_execution_report: `You are a QA Lead creating a TEST EXECUTION REPORT for a specific sprint or release cycle.

${header}

REQUIRED SECTIONS — generate ALL:
1. Execution Overview — sprint/release name, execution period, team members, environment used
2. Test Execution Summary — table: Test Suite, Total Cases, Executed, Passed, Failed, Blocked, Skipped, Pass Rate %
3. Daily Execution Progress — table: Date, Planned, Executed, Cumulative %, Blockers
4. Failed Test Cases — table: Test ID, Title, Module, Failure Reason, Defect ID, Severity, Retest Status
5. Blocked Test Cases — table: Test ID, Title, Blocker Description, Blocked Since, Resolution ETA
6. Automation Execution Results — table: Suite, Total, Passed, Failed, Flaky, Execution Time, Last Run
7. Defects Raised This Cycle — table: Defect ID, Title, Severity, Priority, Module, Status, Assignee
8. Test Environment Issues — incidents, downtime, impact on testing
9. Execution Metrics — Test Execution Rate, Defect Detection Rate, Automation vs Manual ratio
10. Risks & Recommendations — testing risks, schedule impact, recommendations for next cycle`,

    uat_signoff: `You are a Business Analyst / QA Lead creating a UAT SIGN-OFF DOCUMENT for formal user acceptance.

${header}

REQUIRED SECTIONS — generate ALL:
1. UAT Overview — purpose, scope, participants, UAT period, success criteria
2. Business Scenarios Tested — table: Scenario ID, Business Process, Description, Priority, Status (Pass/Fail/Partial), Tester
3. UAT Test Results Summary — table: Module, Scenarios, Passed, Failed, Blocked, Acceptance %
4. Defects Found During UAT — table: Defect ID, Description, Severity, Business Impact, Resolution Status, Accepted for Release (Y/N)
5. Deferred Items — features or fixes deferred to next release with business justification
6. User Feedback Summary — categorized feedback from UAT participants
7. Training & Documentation Readiness — table: Item (User Guide, FAQ, Training Video, Release Notes), Status, Owner
8. Go-Live Readiness Checklist — table: Criteria, Status (Ready/Not Ready), Evidence, Owner
9. Formal Acceptance Decision — ACCEPT / CONDITIONAL ACCEPT / REJECT with conditions
10. Sign-off Table — table: Role (Business Owner, Product Manager, UAT Lead, QA Lead, IT Director), Name, Decision, Date, Signature`,

    risk_assessment: `You are a QA Risk Manager creating a RISK ASSESSMENT MATRIX for testing activities.

${header}

REQUIRED SECTIONS — generate ALL:
1. Risk Assessment Overview — methodology (probability × impact), risk appetite, assessment scope
2. Risk Scoring Matrix — 5×5 grid: Probability (Very Low to Very High) × Impact (Negligible to Critical), color-coded zones (Green/Yellow/Orange/Red)
3. Identified Testing Risks — detailed table: Risk ID, Category (Technical, Resource, Schedule, Scope, External, Data), Risk Description, Probability (1-5), Impact (1-5), Risk Score, Risk Level (Low/Medium/High/Critical), Mitigation Strategy, Contingency Plan, Owner, Status, Review Date
4. Risk Categories Breakdown:
   a. Technical Risks — system complexity, integration points, new technology, performance
   b. Resource Risks — skill gaps, availability, knowledge dependency
   c. Schedule Risks — compressed timelines, dependency delays, environment availability
   d. Scope Risks — requirement changes, scope creep, unclear acceptance criteria
   e. External Risks — third-party dependencies, vendor SLAs, regulatory changes
   f. Data Risks — test data availability, data privacy, data refresh
5. Risk Heat Map — summary table: Risk Level, Count, Top Risk per Level
6. Mitigation Plan Timeline — table: Risk ID, Mitigation Action, Start Date, Target Date, Owner, Status
7. Risk Monitoring & Review — review cadence, escalation criteria, risk register maintenance process
8. Residual Risk Summary — risks accepted after mitigation with business justification`,
  };

  return prompts[docType] ?? prompts.test_strategy;
}

export async function generateQADocumentation(input: string, docType: QADocType) {
  const dateStr = new Date().toISOString().split('T')[0];
  const docTypeLabel = docType.replace(/_/g, ' ');

  const systemPrompt = `${getDocTypePrompt(docType, dateStr)}

Return ONLY valid JSON in this exact structure:
{
  "document": {
    "title": "Specific title for this ${docTypeLabel}",
    "type": "${docType}",
    "version": "1.0",
    "author": "QA Team",
    "date": "${dateStr}",
    "status": "Draft"
  },
  "sections": [
    {
      "heading": "Section heading",
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
  "markdownOutput": "The COMPLETE document in professional markdown format with ALL sections and tables rendered as markdown. Include the version history table at the top and sign-off table at the bottom. This must be copy-paste ready for Confluence.",
  "summary": "One-line summary"
}

IMPORTANT:
- Generate EVERY section listed above. Do not skip any.
- Populate tables with realistic sample data based on the user's project context.
- The markdownOutput MUST contain the full rendered document, not a summary.
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
  if (systemPrompt.includes('quality evaluator')) {
    return JSON.stringify({ score: 78, breakdown: { clarity: 82, reproducibility: 75, completeness: 80, technicalDetail: 70, actionability: 83 }, suggestions: ['Add browser version', 'Include network conditions', 'Add timestamps'] });
  }
  if (systemPrompt.includes('duplicate bug detector')) {
    return JSON.stringify({ duplicates: [] });
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
  if (systemPrompt.includes('API test automation')) {
    return JSON.stringify({ endpoint: { method: 'POST', path: '/api/login', description: 'User authentication endpoint' }, testScripts: [
      { name: 'Valid login returns 200', description: 'Test successful authentication', category: 'happy_path', code: '// Test code here' },
      { name: 'Missing password returns 400', description: 'Test validation', category: 'validation', code: '// Test code here' },
    ], setupCode: '// Setup code', envVariables: { BASE_URL: 'http://localhost:3000' }, totalTests: 2 });
  }
  if (systemPrompt.includes('release notes')) {
    return JSON.stringify({ version: '2.5.0', date: new Date().toISOString().split('T')[0], title: 'Performance & Bug Fix Release', summary: 'Improved performance and fixed critical bugs', sections: { newFeatures: [{ title: 'Dark mode support', description: 'Full dark mode theme', ticket: 'FEAT-123' }], improvements: [{ title: 'Page load speed', description: '40% faster dashboard loading', ticket: 'PERF-456' }], bugFixes: [{ title: 'Login crash fix', description: 'Fixed SSO crash on OAuth callback', ticket: 'BUG-789', severity: 'critical' }], breakingChanges: [], knownIssues: [] }, markdownOutput: '# Release Notes v2.5.0\n...', slackOutput: '🚀 *v2.5.0 Released!*\n...' });
  }
  if (systemPrompt.includes('test data')) {
    return JSON.stringify({ scenario: 'User registration', schema: { fields: [{ name: 'email', type: 'email', constraints: 'unique, valid format' }, { name: 'name', type: 'string', constraints: '2-50 chars' }] }, validData: [{ email: 'john@example.com', name: 'John Doe' }], edgeCaseData: [{ email: 'a@b.co', name: 'Jo', _note: 'Minimum valid length' }], invalidData: [{ email: 'not-an-email', name: '', _note: 'Invalid email format', _expectedError: 'Invalid email' }], formattedOutput: '[]', totalRecords: 3 });
  }
  if (systemPrompt.includes('sprint test plan')) {
    return JSON.stringify({ testPlan: { sprintName: 'Sprint 24', objective: 'Test new features and regression', scope: 'Authentication, Billing, Dashboard', riskAssessment: 'Medium risk', estimatedHours: 40, startDate: 'Day 1', testEnvironments: ['staging', 'QA'] }, stories: [], regressionSuite: [], schedule: [{ day: 1, activities: ['Setup test environment', 'Review stories'], milestone: 'Test prep complete' }], entryExitCriteria: { entry: ['Build deployed to staging'], exit: ['All P0/P1 tests pass'] }, risks: [], markdownOutput: '# Sprint 24 Test Plan\n...' });
  }
  if (systemPrompt.includes('automation')) {
    return JSON.stringify({ framework: 'playwright', language: 'typescript', files: [{ filename: 'tests/login.spec.ts', description: 'Login automation tests', code: 'import { test, expect } from "@playwright/test";\n\ntest("should login successfully", async ({ page }) => {\n  await page.goto("/login");\n  await page.fill("#email", "user@test.com");\n  await page.fill("#password", "Pass123!");\n  await page.click("button[type=submit]");\n  await expect(page).toHaveURL("/dashboard");\n});' }], packageJson: { scripts: { test: 'playwright test' }, devDependencies: { '@playwright/test': '^1.40.0' } }, setupInstructions: ['npm install', 'npx playwright install'], runCommand: 'npx playwright test' });
  }
  if (systemPrompt.includes('coverage expert')) {
    return JSON.stringify({ analysis: { existingCoverage: 'Basic happy path tests', gaps: ['No negative tests', 'No edge cases', 'No security tests'], currentScore: 45, projectedScore: 78 }, newTestCases: [{ category: 'negative', title: 'Invalid input handling', description: 'Test with malformed data', steps: ['Submit empty form', 'Check error messages'], expectedResult: 'Proper validation errors shown', priority: 'P1', whyNeeded: 'Could miss validation bugs' }], totalNewTests: 5, coverageImprovement: '+33%' });
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

    return JSON.stringify({
      document: { title: mockTitle, type: mockType, version: '1.0', author: 'QA Team', date: dateStr, status: 'Draft' },
      sections: [
        { heading: '1. Executive Summary', content: `This ${mockTitle} has been prepared for [Project Name] by the QA team at [Company Name]. It covers all testing activities and provides a comprehensive overview of quality assurance processes, metrics, and recommendations.`, subsections: [{ heading: '1.1 Purpose', content: 'Define the approach, scope, and objectives of testing activities to ensure product quality meets enterprise standards.' }] },
        { heading: '2. Scope & Objectives', content: 'All modules identified in the project scope are covered by this document. Testing objectives are aligned with business goals and quality KPIs.', subsections: [{ heading: '2.1 In Scope', content: 'User Authentication, Product Catalog, Shopping Cart, Checkout, Payment Integration, Order Management, Admin Panel' }, { heading: '2.2 Out of Scope', content: 'Third-party payment provider internal testing, legacy v1 system maintenance' }] },
        { heading: '3. Detailed Analysis', content: 'The following sections provide detailed breakdowns of all quality metrics, test results, and risk assessments as applicable to this document type.', subsections: [] },
      ],
      tables,
      markdownOutput: `# ${mockTitle}\n\n**[Company Name]** | **[Project Name]**\n\n| Version | Date | Author | Change Description |\n|---------|------|--------|-------------------|\n| 1.0 | ${dateStr} | QA Lead | Initial draft |\n\n---\n\n## 1. Executive Summary\n\nThis document has been prepared for [Project Name] by the QA team at [Company Name].\n\n## 2. Scope & Objectives\n\nAll modules are in scope for testing activities.\n\n---\n\n## Document Approval\n\n| Role | Name | Signature | Date |\n|------|------|-----------|------|\n| QA Lead | ____________ | ____________ | ____________ |\n| Dev Lead | ____________ | ____________ | ____________ |\n| Product Owner | ____________ | ____________ | ____________ |`,
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
