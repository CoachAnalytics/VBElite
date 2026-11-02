ALTER TABLE "athletes" ALTER COLUMN "research_consent" SET DEFAULT true;--> statement-breakpoint
-- Existing accounts join the anonymous statistics too (the dataset started the same day).
UPDATE "athletes" SET "research_consent" = true;
