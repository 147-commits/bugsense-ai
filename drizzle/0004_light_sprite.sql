CREATE TABLE "RateLimitBucket" (
	"key" varchar NOT NULL,
	"windowStart" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "RateLimitBucket_key_windowStart_pk" PRIMARY KEY("key","windowStart")
);
--> statement-breakpoint
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket" USING btree ("windowStart");