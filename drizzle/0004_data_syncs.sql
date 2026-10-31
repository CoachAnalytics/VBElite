CREATE TABLE "data_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"sha" text,
	"schools" integer,
	"message" text
);
