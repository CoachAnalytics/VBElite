CREATE TABLE "athlete_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"athlete_id" integer NOT NULL,
	"season" integer NOT NULL,
	"level" text NOT NULL,
	"position" text NOT NULL,
	"matches" integer,
	"sets" integer,
	"kills" integer,
	"attack_errors" integer,
	"attempts" integer,
	"assists" integer,
	"aces" integer,
	"serve_errors" integer,
	"digs" integer,
	"receptions" integer,
	"reception_errors" integer,
	"solo_blocks" integer,
	"block_assists" integer,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "maxpreps_url" text;--> statement-breakpoint
ALTER TABLE "recruiting_outcomes" ADD COLUMN "stats" text;--> statement-breakpoint
ALTER TABLE "athlete_seasons" ADD CONSTRAINT "athlete_seasons_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_seasons_unique" ON "athlete_seasons" USING btree ("athlete_id","season","level");