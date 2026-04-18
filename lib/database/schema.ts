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
export const planTierEnum = pgEnum('PlanTier', ['FREE', 'PRO', 'ENTERPRISE']);
export const integrationTypeEnum = pgEnum('IntegrationType', ['GITHUB', 'JIRA', 'LINEAR', 'SLACK', 'WEBHOOK']);

// ─── Multi-tenancy Tables ─────────────────────────────────────────────────────

export const users = pgTable('User', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  email: varchar('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  name: varchar('name'),
  avatarUrl: varchar('avatarUrl'),
  passwordHash: varchar('passwordHash'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index('User_email_idx').on(t.email),
}));

export const organizations = pgTable('Organization', {
  id: varchar('id').primaryKey().$defaultFn(cuid),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull().unique(),
  planTier: planTierEnum('planTier').notNull().default('FREE'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: index('Organization_slug_idx').on(t.slug),
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
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
  usageLogs: many(usageLogs),
  integrations: many(integrations),
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

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, { fields: [integrations.organizationId], references: [organizations.id] }),
  project: one(projects, { fields: [integrations.projectId], references: [projects.id] }),
}));

export const bugReportsRelations = relations(bugReports, ({ one, many }) => ({
  project: one(projects, { fields: [bugReports.projectId], references: [projects.id] }),
  duplicateOf: one(bugReports, { fields: [bugReports.duplicateOfId], references: [bugReports.id], relationName: 'BugReportDuplicates' }),
  duplicates: many(bugReports, { relationName: 'BugReportDuplicates' }),
  cluster: one(bugClusters, { fields: [bugReports.clusterId], references: [bugClusters.id] }),
  testCases: many(testCases),
  chatMessages: many(chatMessages),
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
