CREATE TABLE "BugJiraLink" (
	"id" varchar PRIMARY KEY NOT NULL,
	"bugReportId" varchar NOT NULL,
	"integrationId" varchar NOT NULL,
	"jiraIssueKey" varchar NOT NULL,
	"jiraIssueId" varchar NOT NULL,
	"jiraCloudId" varchar NOT NULL,
	"lastOutboundHash" varchar,
	"lastOutboundAt" timestamp,
	"lastInboundAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProcessedJiraEvent" (
	"eventId" varchar PRIMARY KEY NOT NULL,
	"integrationId" varchar NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "BugJiraLink" ADD CONSTRAINT "BugJiraLink_bugReportId_BugReport_id_fk" FOREIGN KEY ("bugReportId") REFERENCES "public"."BugReport"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BugJiraLink" ADD CONSTRAINT "BugJiraLink_integrationId_Integration_id_fk" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProcessedJiraEvent" ADD CONSTRAINT "ProcessedJiraEvent_integrationId_Integration_id_fk" FOREIGN KEY ("integrationId") REFERENCES "public"."Integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "BugJiraLink_bugReportId_key" ON "BugJiraLink" USING btree ("bugReportId");--> statement-breakpoint
CREATE INDEX "BugJiraLink_jiraIssueKey_idx" ON "BugJiraLink" USING btree ("jiraIssueKey");--> statement-breakpoint
CREATE INDEX "BugJiraLink_integrationId_idx" ON "BugJiraLink" USING btree ("integrationId");--> statement-breakpoint
CREATE INDEX "ProcessedJiraEvent_integrationId_idx" ON "ProcessedJiraEvent" USING btree ("integrationId");--> statement-breakpoint
CREATE INDEX "ProcessedJiraEvent_receivedAt_idx" ON "ProcessedJiraEvent" USING btree ("receivedAt");