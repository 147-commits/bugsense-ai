export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE';

export interface BugReport {
  id: string;
  rawInput: string;
  title: string;
  description: string;
  severity: Severity;
  priority: Priority;
  status: BugStatus;
  stepsToReproduce: string[];
  expectedResult: string | null;
  actualResult: string | null;
  environment: EnvironmentInfo | null;
  rootCauseHypotheses: string[];
  affectedModules: string[];
  qualityScore: number | null;
  duplicateOfId: string | null;
  screenshotUrls: string[];
  logContent: string | null;
  aiAnalysis: AIAnalysis | null;
  impactPrediction: ImpactPrediction | null;
  tags: string[];
  clusterId: string | null;
  testCases?: TestCase[];
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentInfo {
  os?: string;
  browser?: string;
  version?: string;
  device?: string;
  resolution?: string;
  network?: string;
  [key: string]: string | undefined;
}

export interface AIAnalysis {
  summary: string;
  technicalDetails: string;
  suggestedFix: string;
  relatedAreas: string[];
  confidence: number;
}

export interface ImpactPrediction {
  userImpact: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  affectedModules: string[];
  estimatedUsersImpacted: string;
  businessImpact: string;
  testCoverageSuggestions: string[];
}

export interface TestCase {
  id: string;
  bugReportId: string;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  type: string;
  priority: Priority;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  bugReportId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface BugCluster {
  id: string;
  name: string;
  description: string | null;
  bugCount: number;
  createdAt: string;
}

export interface AnalyzeRequest {
  rawInput: string;
  screenshotBase64?: string;
  logContent?: string;
}

export interface AnalyzeResponse {
  bugReport: BugReport;
  qualityScore: number;
  duplicates: BugReport[];
  testCases: TestCase[];
  reproductionChecklist: string[];
}

export interface DashboardStats {
  totalBugs: number;
  criticalBugs: number;
  resolvedBugs: number;
  avgQualityScore: number;
  severityDistribution: { name: string; value: number; color: string }[];
  recentBugs: BugReport[];
  trendData: { date: string; bugs: number; resolved: number }[];
  topModules: { module: string; count: number }[];
}

export interface ExportConfig {
  platform: 'jira' | 'github';
  bugReportId: string;
  projectKey?: string;
  repository?: string;
  labels?: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  techStack: string[];
  _count: { bugReports: number; members: number };
}
