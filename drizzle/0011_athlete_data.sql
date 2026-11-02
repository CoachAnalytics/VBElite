CREATE TABLE "athlete_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"age_years" real NOT NULL,
	"age_exact" boolean NOT NULL,
	"position" text NOT NULL,
	"height_in" real,
	"standing_reach_in" real,
	"block_touch_in" real,
	"approach_touch_in" real,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiting_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"school_id" integer NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"grad_year" integer NOT NULL,
	"position" text NOT NULL,
	"age_years" real NOT NULL,
	"age_exact" boolean NOT NULL,
	"height_in" real,
	"standing_reach_in" real,
	"block_touch_in" real,
	"approach_touch_in" real,
	"measured_at" timestamp with time zone,
	"program_level" real,
	"conference" text,
	"club_division" text,
	"club_role" text,
	"coach_projection" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recruiting_outcomes_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "research_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "research_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "athlete_measurements" ADD CONSTRAINT "athlete_measurements_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiting_outcomes" ADD CONSTRAINT "recruiting_outcomes_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiting_outcomes" ADD CONSTRAINT "recruiting_outcomes_event_id_recruiting_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."recruiting_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiting_outcomes" ADD CONSTRAINT "recruiting_outcomes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;