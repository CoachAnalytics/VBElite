ALTER TABLE "seasons" ALTER COLUMN "wins" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "losses" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "commits" ADD COLUMN "high_school" text;--> statement-breakpoint
ALTER TABLE "commits" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "ncaa_org_id" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "scorecard_unit_id" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "official_name" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "team" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "athletics_website" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "admission_rate" real;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "sat_avg" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "act_25" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "act_75" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "cost_of_attendance" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "avg_net_price" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "graduation_rate" real;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "retention_rate" real;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "median_earnings" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "student_faculty_ratio" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "researched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "sources" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "ncaa_seed" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_ncaa_org_id_unique" UNIQUE("ncaa_org_id");