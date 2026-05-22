ALTER TYPE "public"."PlanTier" ADD VALUE 'TEAM' BEFORE 'ENTERPRISE';--> statement-breakpoint
CREATE TABLE "MonthlyUsageCounter" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organizationId" varchar NOT NULL,
	"yearMonth" varchar NOT NULL,
	"aiCalls" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProcessedStripeEvent" (
	"eventId" varchar PRIMARY KEY NOT NULL,
	"type" varchar NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" varchar;--> statement-breakpoint
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" varchar;--> statement-breakpoint
ALTER TABLE "MonthlyUsageCounter" ADD CONSTRAINT "MonthlyUsageCounter_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "MonthlyUsageCounter_org_month_key" ON "MonthlyUsageCounter" USING btree ("organizationId","yearMonth");--> statement-breakpoint
CREATE INDEX "MonthlyUsageCounter_organizationId_idx" ON "MonthlyUsageCounter" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "ProcessedStripeEvent_receivedAt_idx" ON "ProcessedStripeEvent" USING btree ("receivedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization" USING btree ("stripeCustomerId");