CREATE TABLE "athletes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"grad_year" integer NOT NULL,
	"position" text NOT NULL,
	"height_in" integer,
	"home_zip" text NOT NULL,
	"home_city" text,
	"home_state" text,
	"latitude" real,
	"longitude" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"name" text NOT NULL,
	"grad_year" integer NOT NULL,
	"position_raw" text,
	"positions" text NOT NULL,
	"primary_position" text NOT NULL,
	"height_in" integer,
	"hometown" text,
	"club" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "roster_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"season" integer NOT NULL,
	"name" text NOT NULL,
	"class_year" text NOT NULL,
	"redshirt" boolean DEFAULT false NOT NULL,
	"position_raw" text,
	"positions" text NOT NULL,
	"primary_position" text NOT NULL,
	"height_in" integer
);
--> statement-breakpoint
CREATE TABLE "saved_schools" (
	"athlete_id" integer NOT NULL,
	"school_id" integer NOT NULL,
	"tier" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_schools_athlete_id_school_id_pk" PRIMARY KEY("athlete_id","school_id")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"latitude" real,
	"longitude" real,
	"division" text NOT NULL,
	"conference" text,
	"control" text,
	"enrollment" integer,
	"enrollment_note" text,
	"tuition_in_state" integer,
	"tuition_out_state" integer,
	"tuition_year" text,
	"head_coach" text,
	"coach_since" integer,
	"apr" integer,
	"apr_note" text,
	"roster_size" integer,
	"roster_season" integer,
	"positions_covered" text DEFAULT '' NOT NULL,
	"commit_data_quality" text,
	"recruiting_note" text,
	"program_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"year" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"postseason" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_players" ADD CONSTRAINT "roster_players_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_schools" ADD CONSTRAINT "saved_schools_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_schools" ADD CONSTRAINT "saved_schools_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_school_year" ON "seasons" USING btree ("school_id","year");