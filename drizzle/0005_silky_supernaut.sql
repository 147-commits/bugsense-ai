CREATE TYPE "public"."AuthEventKind" AS ENUM('SIGNUP', 'SIGNIN', 'SIGNIN_FAILED', 'SIGNOUT', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_VERIFIED');--> statement-breakpoint
CREATE TABLE "AuthEvent" (
	"id" varchar PRIMARY KEY NOT NULL,
	"userId" varchar,
	"kind" "AuthEventKind" NOT NULL,
	"ip" varchar,
	"userAgent" varchar,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" timestamp;--> statement-breakpoint
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AuthEvent_userId_idx" ON "AuthEvent" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "AuthEvent_kind_idx" ON "AuthEvent" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "AuthEvent_createdAt_idx" ON "AuthEvent" USING btree ("createdAt");