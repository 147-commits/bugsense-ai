import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, pgEnum, doublePrecision, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Use cuid2 for IDs (drop-in cuid replacement). Falls back to crypto if not installed.
function cuid() {
  try { return createId(); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const severityEnum = pgEnum('Severity', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export const priorityEnum = pgEnum('Priority', ['P0', 'P1', 'P2', 'P3', 'P4']);
export const bugStatusEnum = pgEnum('BugStatus', ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE']);
export const memberRoleEnum = pgEnum('MemberRole', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const planTierEnum = pgEnum('PlanTier', ['FREE', 'PRO', 'TEAM', 'ENTERPRISE']);
export const integrationTypeEnum = pgEnum('IntegrationType', ['GITHUB', 'JIRA', 'LINEAR', 'SLACK', 'WEBHOOK']);
export const verdictEnum = pgEnum('Verdict', ['GO', 'CAUTION', 'NO_GO']);

// ─── Multi-tenancy Tables ─────────────────────────────────────────────────────

export const users = pgTable('User', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  email: varchar('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  name: varchar('name'),
  // `image` mirrors NextAuth's expected column name and is populated by
  // OAuth providers via the Drizzle adapter. `avatarUrl` remains for legacy reads.
  image: varchar('image'),
  avatarUrl: varchar('avatarUrl'),
  passwordHash: varchar('passwordHash'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index('User_email_idx').on(t.email),
}));

// ─── NextAuth adapter tables ──────────────────────────────────────────────────

export const accounts = pgTable('Account', {
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type').notNull(),
  provider: varchar('provider').notNull(),
  providerAccountId: varchar('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type'),
  scope: varchar('scope'),
  id_token: text('id_token'),
  session_state: varchar('session_state'),
}, (t) => ({
  pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  userIdx: index('Account_userId_idx').on(t.userId),
}));

export const sessions = pgTable('Session', {
  sessionToken: varchar('sessionToken').primaryKey(),
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => ({
  userIdx: index('Session_userId_idx').on(t.userId),
}));

export const verificationTokens = pgTable('VerificationToken', {
  identifier: varchar('identifier').notNull(),
  token: varchar('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.identifier, t.token] }),
}));

// ─── Custom email verification + password reset tokens ───────────────────────

export const emailVerificationTokens = pgTable('EmailVerificationToken', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('tokenHash').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  usedAt: timestamp('usedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('EmailVerificationToken_tokenHash_key').on(t.tokenHash),
  userIdx: index('EmailVerificationToken_userId_idx').on(t.userId),
}));

export const rateLimitBuckets = pgTable('RateLimitBucket', {
  key: varchar('key').notNull(),
  windowStart: timestamp('windowStart', { mode: 'date' }).notNull(),
  count: integer('count').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.key, t.windowStart] }),
  windowIdx: index('RateLimitBucket_windowStart_idx').on(t.windowStart),
}));

export const processedStripeEvents = pgTable('ProcessedStripeEvent', {
  eventId: varchar('eventId').primaryKey(),
  type: varchar('type').notNull(),
  receivedAt: timestamp('receivedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  receivedIdx: index('ProcessedStripeEvent_receivedAt_idx').on(t.receivedAt),
}));

export const monthlyUsageCounters = pgTable('MonthlyUsageCounter', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  organizationId: varchar('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  // 'YYYY-MM' bucket in UTC.
  yearMonth: varchar('yearMonth').notNull(),
  aiCalls: integer('aiCalls').notNull().default(0),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  orgMonthUnique: uniqueIndex('MonthlyUsageCounter_org_month_key').on(t.organizationId, t.yearMonth),
  orgIdx: index('MonthlyUsageCounter_organizationId_idx').on(t.organizationId),
}));

export const passwordResetTokens = pgTable('PasswordResetToken', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('tokenHash').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  usedAt: timestamp('usedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tokenHashIdx: uniqueIndex('PasswordResetToken_tokenHash_key').on(t.tokenHash),
  userIdx: index('PasswordResetToken_userId_idx').on(t.userId),
}));

export const organizations = pgTable('Organization', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull().unique(),
  planTier: planTierEnum('planTier').notNull().default('FREE'),
  stripeCustomerId: varchar('stripeCustomerId'),
  stripeSubscriptionId: varchar('stripeSubscriptionId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: index('Organization_slug_idx').on(t.slug),
  stripeCustomerIdx: uniqueIndex('Organization_stripeCustomerId_key').on(t.stripeCustomerId),
}));

export const organizationMembers = pgTable('OrganizationMember', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull().default('MEMBER'),
  joinedAt: timestamp('joinedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  userOrgUnique: uniqueIndex('OrganizationMember_userId_organizationId_key').on(t.userId, t.organizationId),
  userIdx: index('OrganizationMember_userId_idx').on(t.userId),
  orgIdx: index('OrganizationMember_organizationId_idx').on(t.organizationId),
}));

export const projects = pgTable('Project', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull(),
  description: text('description'),
  techStack: text('techStack').array().notNull().default(sql`ARRAY[]::text[]`),
  testConventions: jsonb('testConventions'),
  organizationId: varchar('organizationId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  orgSlugUnique: uniqueIndex('Project_organizationId_slug_key').on(t.organizationId, t.slug),
  orgIdx: index('Project_organizationId_idx').on(t.organizationId),
}));

export const projectMembers = pgTable('ProjectMember', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  userId: varchar('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull().default('MEMBER'),
  joinedAt: timestamp('joinedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  userProjectUnique: uniqueIndex('ProjectMember_userId_projectId_key').on(t.userId, t.projectId),
  userIdx: index('ProjectMember_userId_idx').on(t.userId),
  projectIdx: index('ProjectMember_projectId_idx').on(t.projectId),
}));

export const usageLogs = pgTable('UsageLog', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  userId: varchar('userId').references(() => users.id, { onDelete: 'set null' }),
  organizationId: varchar('organizationId').references(() => organizations.id, { onDelete: 'set null' }),
  projectId: varchar('projectId').references(() => projects.id, { onDelete: 'set null' }),
  action: varchar('action').notNull(),
  resourceType: varchar('resourceType'),
  resourceId: varchar('resourceId'),
  tokensUsed: integer('tokensUsed'),
  cost: doublePrecision('cost'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('UsageLog_userId_idx').on(t.userId),
  orgIdx: index('UsageLog_organizationId_idx').on(t.organizationId),
  projectIdx: index('UsageLog_projectId_idx').on(t.projectId),
  createdAtIdx: index('UsageLog_createdAt_idx').on(t.createdAt),
}));

export const integrations = pgTable('Integration', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  organizationId: varchar('organizationId').references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: varchar('projectId').references(() => projects.id, { onDelete: 'cascade' }),
  type: integrationTypeEnum('type').notNull(),
  name: varchar('name').notNull(),
  config: jsonb('config').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  lastSyncAt: timestamp('lastSyncAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('Integration_organizationId_idx').on(t.organizationId),
  projectIdx: index('Integration_projectId_idx').on(t.projectId),
  typeIdx: index('Integration_type_idx').on(t.type),
}));

// ─── Core Bug Tracking Tables ─────────────────────────────────────────────────

export const bugReports = pgTable('BugReport', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  projectId: varchar('projectId').references(() => projects.id, { onDelete: 'set null' }),
  rawInput: text('rawInput').notNull(),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  severity: severityEnum('severity').notNull().default('MEDIUM'),
  priority: priorityEnum('priority').notNull().default('P2'),
  status: bugStatusEnum('status').notNull().default('OPEN'),
  stepsToReproduce: text('stepsToReproduce').array().notNull().default(sql`ARRAY[]::text[]`),
  expectedResult: text('expectedResult'),
  actualResult: text('actualResult'),
  environment: jsonb('environment'),
  rootCauseHypotheses: text('rootCauseHypotheses').array().notNull().default(sql`ARRAY[]::text[]`),
  affectedModules: text('affectedModules').array().notNull().default(sql`ARRAY[]::text[]`),
  qualityScore: doublePrecision('qualityScore'),
  duplicateOfId: varchar('duplicateOfId'),
  screenshotUrls: text('screenshotUrls').array().notNull().default(sql`ARRAY[]::text[]`),
  logContent: text('logContent'),
  aiAnalysis: jsonb('aiAnalysis'),
  impactPrediction: jsonb('impactPrediction'),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
  clusterId: varchar('clusterId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('BugReport_projectId_idx').on(t.projectId),
  severityIdx: index('BugReport_severity_idx').on(t.severity),
  statusIdx: index('BugReport_status_idx').on(t.status),
  createdAtIdx: index('BugReport_createdAt_idx').on(t.createdAt),
  clusterIdx: index('BugReport_clusterId_idx').on(t.clusterId),
}));

export const testCases = pgTable('TestCase', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  bugReportId: varchar('bugReportId').references(() => bugReports.id, { onDelete: 'cascade' }),
  sourceType: varchar('sourceType').notNull().default('bug'),
  sourceInput: text('sourceInput'),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  steps: text('steps').array().notNull().default(sql`ARRAY[]::text[]`),
  expectedResult: text('expectedResult').notNull(),
  type: varchar('type').notNull().default('regression'),
  priority: priorityEnum('priority').notNull().default('P2'),
  framework: varchar('framework'),
  codeSnippet: text('codeSnippet'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  bugReportIdx: index('TestCase_bugReportId_idx').on(t.bugReportId),
  sourceTypeIdx: index('TestCase_sourceType_idx').on(t.sourceType),
}));

export const bugClusters = pgTable('BugCluster', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  name: varchar('name').notNull(),
  description: text('description'),
  bugCount: integer('bugCount').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export const chatMessages = pgTable('ChatMessage', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  bugReportId: varchar('bugReportId').notNull().references(() => bugReports.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  bugReportIdx: index('ChatMessage_bugReportId_idx').on(t.bugReportId),
}));

export const generatedContent = pgTable('GeneratedContent', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  projectId: varchar('projectId').references(() => projects.id, { onDelete: 'set null' }),
  type: varchar('type').notNull(),
  input: text('input').notNull(),
  output: jsonb('output').notNull(),
  framework: varchar('framework'),
  language: varchar('language'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('GeneratedContent_projectId_idx').on(t.projectId),
  typeIdx: index('GeneratedContent_type_idx').on(t.type),
  createdAtIdx: index('GeneratedContent_createdAt_idx').on(t.createdAt),
}));

export const releaseReadinessSnapshots = pgTable('ReleaseReadinessSnapshot', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  projectId: varchar('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  verdict: verdictEnum('verdict').notNull(),
  breakdown: jsonb('breakdown').notNull(),
  blockers: jsonb('blockers').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('ReleaseReadinessSnapshot_projectId_idx').on(t.projectId),
  createdAtIdx: index('ReleaseReadinessSnapshot_createdAt_idx').on(t.createdAt),
}));

export const releaseReadinessSnapshotsRelations = relations(releaseReadinessSnapshots, ({ one }) => ({
  project: one(projects, { fields: [releaseReadinessSnapshots.projectId], references: [projects.id] }),
}));

export const bugJiraLinks = pgTable('BugJiraLink', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  bugReportId: varchar('bugReportId').notNull().references(() => bugReports.id, { onDelete: 'cascade' }),
  integrationId: varchar('integrationId').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  jiraIssueKey: varchar('jiraIssueKey').notNull(),
  jiraIssueId: varchar('jiraIssueId').notNull(),
  jiraCloudId: varchar('jiraCloudId').notNull(),
  lastOutboundHash: varchar('lastOutboundHash'),
  lastOutboundAt: timestamp('lastOutboundAt', { mode: 'date' }),
  lastInboundAt: timestamp('lastInboundAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  bugUnique: uniqueIndex('BugJiraLink_bugReportId_key').on(t.bugReportId),
  jiraKeyIdx: index('BugJiraLink_jiraIssueKey_idx').on(t.jiraIssueKey),
  integrationIdx: index('BugJiraLink_integrationId_idx').on(t.integrationId),
}));

export const processedJiraEvents = pgTable('ProcessedJiraEvent', {
  eventId: varchar('eventId').primaryKey(),
  integrationId: varchar('integrationId').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  receivedAt: timestamp('receivedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  integrationIdx: index('ProcessedJiraEvent_integrationId_idx').on(t.integrationId),
  receivedIdx: index('ProcessedJiraEvent_receivedAt_idx').on(t.receivedAt),
}));

export const analyticsSnapshots = pgTable('AnalyticsSnapshot', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  date: timestamp('date', { mode: 'date' }).notNull().defaultNow(),
  totalBugs: integer('totalBugs').notNull(),
  criticalBugs: integer('criticalBugs').notNull(),
  highBugs: integer('highBugs').notNull(),
  mediumBugs: integer('mediumBugs').notNull(),
  lowBugs: integer('lowBugs').notNull(),
  resolvedBugs: integer('resolvedBugs').notNull(),
  duplicateBugs: integer('duplicateBugs').notNull(),
  avgQualityScore: doublePrecision('avgQualityScore'),
  topModules: jsonb('topModules'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  dateIdx: index('AnalyticsSnapshot_date_idx').on(t.date),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(organizationMembers),
  projectMembers: many(projectMembers),
  usageLogs: many(usageLogs),
  accounts: many(accounts),
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, { fields: [emailVerificationTokens.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
  usageLogs: many(usageLogs),
  integrations: many(integrations),
  monthlyUsageCounters: many(monthlyUsageCounters),
}));

export const monthlyUsageCountersRelations = relations(monthlyUsageCounters, ({ one }) => ({
  organization: one(organizations, { fields: [monthlyUsageCounters.organizationId], references: [organizations.id] }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  members: many(projectMembers),
  bugReports: many(bugReports),
  generatedContent: many(generatedContent),
  usageLogs: many(usageLogs),
  integrations: many(integrations),
  releaseReadinessSnapshots: many(releaseReadinessSnapshots),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, { fields: [usageLogs.userId], references: [users.id] }),
  organization: one(organizations, { fields: [usageLogs.organizationId], references: [organizations.id] }),
  project: one(projects, { fields: [usageLogs.projectId], references: [projects.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  organization: one(organizations, { fields: [integrations.organizationId], references: [organizations.id] }),
  project: one(projects, { fields: [integrations.projectId], references: [projects.id] }),
  bugJiraLinks: many(bugJiraLinks),
  processedJiraEvents: many(processedJiraEvents),
}));

export const bugReportsRelations = relations(bugReports, ({ one, many }) => ({
  project: one(projects, { fields: [bugReports.projectId], references: [projects.id] }),
  duplicateOf: one(bugReports, { fields: [bugReports.duplicateOfId], references: [bugReports.id], relationName: 'BugReportDuplicates' }),
  duplicates: many(bugReports, { relationName: 'BugReportDuplicates' }),
  cluster: one(bugClusters, { fields: [bugReports.clusterId], references: [bugClusters.id] }),
  testCases: many(testCases),
  chatMessages: many(chatMessages),
  jiraLink: one(bugJiraLinks, { fields: [bugReports.id], references: [bugJiraLinks.bugReportId] }),
}));

export const bugJiraLinksRelations = relations(bugJiraLinks, ({ one }) => ({
  bugReport: one(bugReports, { fields: [bugJiraLinks.bugReportId], references: [bugReports.id] }),
  integration: one(integrations, { fields: [bugJiraLinks.integrationId], references: [integrations.id] }),
}));

export const processedJiraEventsRelations = relations(processedJiraEvents, ({ one }) => ({
  integration: one(integrations, { fields: [processedJiraEvents.integrationId], references: [integrations.id] }),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  bugReport: one(bugReports, { fields: [testCases.bugReportId], references: [bugReports.id] }),
}));

export const bugClustersRelations = relations(bugClusters, ({ many }) => ({
  bugReports: many(bugReports),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  bugReport: one(bugReports, { fields: [chatMessages.bugReportId], references: [bugReports.id] }),
}));

export const generatedContentRelations = relations(generatedContent, ({ one }) => ({
  project: one(projects, { fields: [generatedContent.projectId], references: [projects.id] }),
}));

// ─── Type exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type TestCase = typeof testCases.$inferSelect;
export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
export type ReleaseReadinessSnapshot = typeof releaseReadinessSnapshots.$inferSelect;
export type NewReleaseReadinessSnapshot = typeof releaseReadinessSnapshots.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type BugJiraLink = typeof bugJiraLinks.$inferSelect;
export type NewBugJiraLink = typeof bugJiraLinks.$inferInsert;
export type ProcessedJiraEvent = typeof processedJiraEvents.$inferSelect;
export type NewProcessedJiraEvent = typeof processedJiraEvents.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type ProcessedStripeEvent = typeof processedStripeEvents.$inferSelect;
export type NewProcessedStripeEvent = typeof processedStripeEvents.$inferInsert;
export type MonthlyUsageCounter = typeof monthlyUsageCounters.$inferSelect;
export type NewMonthlyUsageCounter = typeof monthlyUsageCounters.$inferInsert;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;
