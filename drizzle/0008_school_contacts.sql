CREATE TABLE "school_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"name" text,
	"title" text,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "recruiting_questionnaire" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "contacts_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "contacts_source" text;--> statement-breakpoint
ALTER TABLE "school_contacts" ADD CONSTRAINT "school_contacts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;