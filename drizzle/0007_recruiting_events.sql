CREATE TABLE "recruiting_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"school_id" integer NOT NULL,
	"type" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"coach_name" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiting_events" ADD CONSTRAINT "recruiting_events_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiting_events" ADD CONSTRAINT "recruiting_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;