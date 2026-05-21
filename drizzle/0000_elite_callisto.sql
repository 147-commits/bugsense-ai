CREATE TYPE "public"."BugStatus" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE');--> statement-breakpoint
CREATE TYPE "public"."IntegrationType" AS ENUM('GITHUB', 'JIRA', 'LINEAR', 'SLACK', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."MemberRole" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."PlanTier" AS ENUM('FREE', 'PRO', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."Priority" AS ENUM('P0', 'P1', 'P2', 'P3', 'P4');--> statement-breakpoint
CREATE TYPE "public"."Severity" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');--> statement-breakpoint
CREATE TYPE "public"."Verdict" AS ENUM('GO', 'CAUTION', 'NO_GO');--> statement-breakpoint
CREATE TABLE "AnalyticsSnapshot" (
	"id" varchar PRIMARY KEY NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"totalBugs" integer NOT NULL,
	"criticalBugs" integer NOT NULL,
	"highBugs" integer NOT NULL,
	"mediumBugs" integer NOT NULL,
	"lowBugs" integer NOT NULL,
	"resolvedBugs" integer NOT NULL,
	"duplicateBugs" integer NOT NULL,
	"avgQualityScore" double precision,
	"topModules" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BugCluster" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"bugCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BugReport" (
	"id" varchar PRIMARY KEY NOT NULL,
	"projectId" varchar,
	"rawInput" text NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"severity" "Severity" DEFAULT 'MEDIUM' NOT NULL,
	"priority" "Priority" DEFAULT 'P2' NOT NULL,
	"status" "BugStatus" DEFAULT 'OPEN' NOT NULL,
	"stepsToReproduce" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"expectedResult" text,
	"actualResult" text,
	"environment" jsonb,
	"rootCauseHypotheses" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"affectedModules" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"qualityScore" double precision,
	"duplicateOfId" varchar,
	"screenshotUrls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"logContent" text,
	"aiAnalysis" jsonb,
	"impactPrediction" jsonb,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"clusterId" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChatMessage" (
	"id" varchar PRIMARY KEY NOT NULL,
	"bugReportId" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "GeneratedContent" (
	"id" varchar PRIMARY KEY NOT NULL,
	"projectId" varchar,
	"type" varchar NOT NULL,
	"input" text NOT NULL,
	"output" jsonb NOT NULL,
	"framework" varchar,
	"language" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Integration" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organizationId" varchar,
	"projectId" varchar,
	"type" "IntegrationType" NOT NULL,
	"name" varchar NOT NULL,
	"config" jsonb NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSyncAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OrganizationMember" (
	"id" varchar PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"organizationId" varchar NOT NULL,
	"role" "MemberRole" DEFAULT 'MEMBER' NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"planTier" "PlanTier" DEFAULT 'FREE' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ProjectMember" (
	"id" varchar PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"projectId" varchar NOT NULL,
	"role" "MemberRole" DEFAULT 'MEMBER' NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"techStack" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"testConventions" jsonb,
	"organizationId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReleaseReadinessSnapshot" (
	"id" varchar PRIMARY KEY NOT NULL,
	"projectId" varchar NOT NULL,
	"score" integer NOT NULL,
	"verdict" "Verdict" NOT NULL,
	"breakdown" jsonb NOT NULL,
	"blockers" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TestCase" (
	"id" varchar PRIMARY KEY NOT NULL,
	"bugReportId" varchar,
	"sourceType" varchar DEFAULT 'bug' NOT NULL,
	"sourceInput" text,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"steps" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"expectedResult" text NOT NULL,
	"type" varchar DEFAULT 'regression' NOT NULL,
	"priority" "Priority" DEFAULT 'P2' NOT NULL,
	"framework" varchar,
	"codeSnippet" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UsageLog" (
	"id" varchar PRIMARY KEY NOT NULL,
	"userId" varchar,
	"organizationId" varchar,
	"projectId" varchar,
	"action" varchar NOT NULL,
	"resourceType" varchar,
	"resourceId" varchar,
	"tokensUsed" integer,
	"cost" double precision,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"emailVerified" timestamp,
	"name" varchar,
	"avatarUrl" varchar,
	"passwordHash" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_bugReportId_BugReport_id_fk" FOREIGN KEY ("bugReportId") REFERENCES "public"."BugReport"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReleaseReadinessSnapshot" ADD CONSTRAINT "ReleaseReadinessSnapshot_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_bugReportId_BugReport_id_fk" FOREIGN KEY ("bugReportId") REFERENCES "public"."BugReport"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AnalyticsSnapshot_date_idx" ON "AnalyticsSnapshot" USING btree ("date");--> statement-breakpoint
CREATE INDEX "BugReport_projectId_idx" ON "BugReport" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "BugReport_severity_idx" ON "BugReport" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "BugReport_status_idx" ON "BugReport" USING btree ("status");--> statement-breakpoint
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "BugReport_clusterId_idx" ON "BugReport" USING btree ("clusterId");--> statement-breakpoint
CREATE INDEX "ChatMessage_bugReportId_idx" ON "ChatMessage" USING btree ("bugReportId");--> statement-breakpoint
CREATE INDEX "GeneratedContent_projectId_idx" ON "GeneratedContent" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "GeneratedContent_type_idx" ON "GeneratedContent" USING btree ("type");--> statement-breakpoint
CREATE INDEX "GeneratedContent_createdAt_idx" ON "GeneratedContent" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Integration_organizationId_idx" ON "Integration" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "Integration_projectId_idx" ON "Integration" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "Integration_type_idx" ON "Integration" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember" USING btree ("userId","organizationId");--> statement-breakpoint
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "Organization_slug_idx" ON "Organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember" USING btree ("userId","projectId");--> statement-breakpoint
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember" USING btree ("projectId");--> statement-breakpoint
CREATE UNIQUE INDEX "Project_organizationId_slug_key" ON "Project" USING btree ("organizationId","slug");--> statement-breakpoint
CREATE INDEX "Project_organizationId_idx" ON "Project" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "ReleaseReadinessSnapshot_projectId_idx" ON "ReleaseReadinessSnapshot" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "ReleaseReadinessSnapshot_createdAt_idx" ON "ReleaseReadinessSnapshot" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "TestCase_bugReportId_idx" ON "TestCase" USING btree ("bugReportId");--> statement-breakpoint
CREATE INDEX "TestCase_sourceType_idx" ON "TestCase" USING btree ("sourceType");--> statement-breakpoint
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UsageLog_organizationId_idx" ON "UsageLog" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "UsageLog_projectId_idx" ON "UsageLog" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email");