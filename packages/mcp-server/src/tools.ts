import { z } from 'zod';
import type { BugSenseClient } from './client.js';

// ── Reusable enums ────────────────────────────────────────────────────────────

const Severity = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
const Priority = z.enum(['P0', 'P1', 'P2', 'P3', 'P4']);
const BugStatus = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE']);
const Verdict = z.enum(['GO', 'CAUTION', 'NO_GO']);

// ── Output schemas ────────────────────────────────────────────────────────────

const TestCaseSchema = z
  .object({
    id: z.string(),
    bugReportId: z.string().nullable(),
    sourceType: z.string(),
    title: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
    expectedResult: z.string(),
    type: z.string(),
    priority: Priority,
    framework: z.string().nullable(),
    codeSnippet: z.string().nullable(),
    createdAt: z.string(),
  })
  .passthrough();

const BugSchema = z
  .object({
    id: z.string(),
    projectId: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    severity: Severity,
    priority: Priority,
    status: BugStatus,
    stepsToReproduce: z.array(z.string()),
    expectedResult: z.string().nullable(),
    actualResult: z.string().nullable(),
    affectedModules: z.array(z.string()),
    tags: z.array(z.string()),
    qualityScore: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    testCases: z.array(TestCaseSchema).optional(),
  })
  .passthrough();

const ListBugsOutput = z.object({
  bugs: z.array(BugSchema),
  total: z.number().int().nonnegative(),
});

const GetBugOutput = BugSchema;

const ListTestCasesOutput = z.object({
  testCases: z.array(TestCaseSchema),
  total: z.number().int().nonnegative(),
});

const SignalBreakdownSchema = z.object({
  key: z.enum(['bugs', 'tests', 'quality']),
  label: z.string(),
  weight: z.number(),
  raw: z.number(),
  weightedContribution: z.number(),
  maxContribution: z.number(),
  note: z.string().optional(),
});

const ReadinessOutput = z.object({
  score: z.number().int(),
  verdict: Verdict,
  breakdown: z.array(SignalBreakdownSchema),
  blockers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.literal('critical_bug'),
    }),
  ),
});

const AnalyzeBugOutput = z
  .object({
    bugReport: z.record(z.string(), z.unknown()),
    qualityScore: z.record(z.string(), z.unknown()),
    duplicates: z.unknown(),
    testCases: z.unknown(),
    reproductionChecklist: z.record(z.string(), z.unknown()),
  })
  .passthrough();

// ── Input schemas ─────────────────────────────────────────────────────────────

const ListBugsInput = {
  project_id: z.string().min(1).optional().describe('Filter to a single project.'),
  severity: Severity.optional().describe('Filter to a single severity level.'),
  status: BugStatus.optional().describe('Filter to a single status.'),
  search: z.string().optional().describe('Case-insensitive substring search in title or description.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Max bugs to return after server-side filtering. Default: all matches.'),
};

const GetBugInput = {
  bug_id: z.string().min(1).describe('The bug report ID returned by list_bugs.'),
};

const ListTestCasesInput = {
  project_id: z.string().min(1).optional().describe('Filter to a single project.'),
  limit: z.number().int().min(1).max(500).default(50).describe('Max test cases to return.'),
};

const GetReleaseReadinessInput = {
  project_id: z.string().min(1).describe('Project to score.'),
};

const AnalyzeBugTextInput = {
  raw_input: z.string().min(1).max(20_000).describe('Raw bug description, freeform.'),
  log_content: z.string().max(50_000).optional().describe('Optional log dump.'),
  project_id: z
    .string()
    .min(1)
    .optional()
    .describe('If set, persists the analysed bug into the project.'),
};

// ── Tool definitions ──────────────────────────────────────────────────────────

type ToolDef<I extends z.ZodRawShape, O extends z.ZodTypeAny> = {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  handler: (
    args: z.infer<z.ZodObject<I>>,
    client: BugSenseClient,
  ) => Promise<z.infer<O>>;
};

function def<I extends z.ZodRawShape, O extends z.ZodTypeAny>(t: ToolDef<I, O>): ToolDef<I, O> {
  return t;
}

export const tools = [
  def({
    name: 'list_bugs',
    title: 'List bugs',
    description: 'List bug reports, optionally filtered by project, severity, status, or text search.',
    inputSchema: ListBugsInput,
    outputSchema: ListBugsOutput,
    handler: async (args, client) => {
      const data = await client.get<unknown>('/api/bugs', {
        projectId: args.project_id,
        severity: args.severity,
        status: args.status,
        search: args.search,
      });
      const parsed = ListBugsOutput.parse(data);
      if (args.limit !== undefined) {
        return { bugs: parsed.bugs.slice(0, args.limit), total: parsed.total };
      }
      return parsed;
    },
  }),

  def({
    name: 'get_bug',
    title: 'Get bug',
    description: 'Fetch a single bug report by id, including its test cases.',
    inputSchema: GetBugInput,
    outputSchema: GetBugOutput,
    handler: async (args, client) => {
      // The REST API does not expose /api/bugs/[id]. Use list_bugs and filter
      // client-side. This keeps a single source of truth (the existing route).
      const list = await client.get<unknown>('/api/bugs');
      const parsed = ListBugsOutput.parse(list);
      const bug = parsed.bugs.find((b) => b.id === args.bug_id);
      if (!bug) {
        throw new Error(`Bug not found: ${args.bug_id}`);
      }
      return bug;
    },
  }),

  def({
    name: 'list_test_cases',
    title: 'List test cases',
    description:
      'List test cases for a project, derived from /api/projects/[id]/content. Requires project_id.',
    inputSchema: ListTestCasesInput,
    outputSchema: ListTestCasesOutput,
    handler: async (args, client) => {
      if (!args.project_id) {
        throw new Error('project_id is required for list_test_cases.');
      }
      const data = await client.get<unknown>(
        `/api/projects/${encodeURIComponent(args.project_id)}/content`,
        { type: 'all' },
      );
      const Shape = z
        .object({
          bugReports: z.array(z.object({ testCases: z.array(TestCaseSchema).optional() }).passthrough()),
        })
        .passthrough();
      const parsed = Shape.parse(data);
      const all = parsed.bugReports.flatMap((b) => b.testCases ?? []);
      const limited = all.slice(0, args.limit);
      return { testCases: limited, total: all.length };
    },
  }),

  def({
    name: 'get_release_readiness',
    title: 'Get release readiness',
    description:
      'Compute a 0-100 release readiness score (GO / CAUTION / NO_GO) for a project, with per-signal breakdown and blockers.',
    inputSchema: GetReleaseReadinessInput,
    outputSchema: ReadinessOutput,
    handler: async (args, client) => {
      const data = await client.get<unknown>(
        `/api/readiness/${encodeURIComponent(args.project_id)}`,
      );
      return ReadinessOutput.parse(data);
    },
  }),

  def({
    name: 'analyze_bug_text',
    title: 'Analyze bug text',
    description:
      'Run BugSense\'s full AI bug analysis pipeline on a raw description. Returns a structured bug report, quality score, duplicates, test cases, and reproduction checklist.',
    inputSchema: AnalyzeBugTextInput,
    outputSchema: AnalyzeBugOutput,
    handler: async (args, client) => {
      const data = await client.post<unknown>('/api/analyze', {
        rawInput: args.raw_input,
        logContent: args.log_content,
        projectId: args.project_id,
      });
      return AnalyzeBugOutput.parse(data);
    },
  }),
] as const;

export type AnyTool = (typeof tools)[number];
