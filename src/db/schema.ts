import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- Reference data (shared by every subscriber) ----------

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Identifiers in the NCAA member directory and the College Scorecard
  ncaaOrgId: integer("ncaa_org_id").unique(),
  scorecardUnitId: integer("scorecard_unit_id"),
  officialName: text("official_name"),
  team: text("team"),
  website: text("website"),
  athleticsWebsite: text("athletics_website"),
  city: text("city"),
  state: text("state"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  // D1 | D2 | D3 | NAIA | JUCO
  division: text("division").notNull(),
  conference: text("conference"),
  // public | private
  control: text("control"),
  enrollment: integer("enrollment"),
  enrollmentNote: text("enrollment_note"),
  tuitionInState: integer("tuition_in_state"),
  tuitionOutState: integer("tuition_out_state"),
  tuitionYear: text("tuition_year"),
  // Academics and cost (College Scorecard)
  admissionRate: real("admission_rate"),
  satAvg: integer("sat_avg"),
  act25: integer("act_25"),
  act75: integer("act_75"),
  costOfAttendance: integer("cost_of_attendance"),
  avgNetPrice: integer("avg_net_price"),
  graduationRate: real("graduation_rate"),
  retentionRate: real("retention_rate"),
  medianEarnings: integer("median_earnings"),
  studentFacultyRatio: integer("student_faculty_ratio"),
  headCoach: text("head_coach"),
  coachSince: integer("coach_since"),
  apr: integer("apr"),
  aprNote: text("apr_note"),
  rosterSize: integer("roster_size"),
  // Season the roster rows describe (e.g. 2026 = fall 2026 roster)
  rosterSeason: integer("roster_season"),
  // Comma-separated positions whose roster + commit data has been collected, e.g. "OH"
  positionsCovered: text("positions_covered").notNull().default(""),
  // good | partial
  commitDataQuality: text("commit_data_quality"),
  recruitingNote: text("recruiting_note"),
  programNote: text("program_note"),
  // When the roster/commit/coach research was last done, and the URLs it used (JSON array)
  researchedAt: timestamp("researched_at", { withTimezone: true }),
  sources: text("sources"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    // Null when the season record hasn't been collected yet
    wins: integer("wins"),
    losses: integer("losses"),
    // Postseason finish, e.g. "DNQ", "1st round", "Sweet 16", "Champion"
    postseason: text("postseason"),
    ncaaSeed: integer("ncaa_seed"),
  },
  (t) => [uniqueIndex("seasons_school_year").on(t.schoolId, t.year)],
);

export const rosterPlayers = pgTable("roster_players", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  season: integer("season").notNull(),
  name: text("name").notNull(),
  // Fr | So | Jr | Sr | Grad
  classYear: text("class_year").notNull(),
  redshirt: boolean("redshirt").notNull().default(false),
  positionRaw: text("position_raw"),
  // Normalized, slash-joined, primary first: e.g. "OH/OPP"
  positions: text("positions").notNull(),
  primaryPosition: text("primary_position").notNull(),
  heightIn: integer("height_in"),
});

export const commits = pgTable("commits", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gradYear: integer("grad_year").notNull(),
  positionRaw: text("position_raw"),
  positions: text("positions").notNull(),
  primaryPosition: text("primary_position").notNull(),
  heightIn: integer("height_in"),
  highSchool: text("high_school"),
  hometown: text("hometown"),
  club: text("club"),
  note: text("note"),
  source: text("source"),
});

// ---------- Accounts ----------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // user | admin. Admins can upload school data and manage other admins.
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token; the raw token is never stored
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gradYear: integer("grad_year").notNull(),
  position: text("position").notNull(),
  heightIn: integer("height_in"),
  homeZip: text("home_zip").notNull(),
  homeCity: text("home_city"),
  homeState: text("home_state"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedSchools = pgTable(
  "saved_schools",
  {
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athletes.id, { onDelete: "cascade" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    // top | main | reach | expand — free for the family to organize
    tier: text("tier").notNull().default("main"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.athleteId, t.schoolId] })],
);

// One row per attempt to pull schools.json.gz from the private data repo (daily cron or "Sync now").
export const dataSyncs = pgTable("data_syncs", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  // schedule | manual
  trigger: text("trigger").notNull(),
  // imported | unchanged | error
  status: text("status").notNull(),
  // Git blob SHA of the file that was imported (or found unchanged)
  sha: text("sha"),
  schools: integer("schools"),
  message: text("message"),
});

export type School = typeof schools.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type RosterPlayer = typeof rosterPlayers.$inferSelect;
export type Commit = typeof commits.$inferSelect;
export type Athlete = typeof athletes.$inferSelect;
