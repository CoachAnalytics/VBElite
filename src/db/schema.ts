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
  // Link to the program's online recruiting questionnaire, and when/where staff emails were checked
  recruitingQuestionnaire: text("recruiting_questionnaire"),
  contactsCheckedAt: timestamp("contacts_checked_at", { withTimezone: true }),
  contactsSource: text("contacts_source"),
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

// Volleyball staff a recruit can email, from the program's official staff listing.
export const schoolContacts = pgTable("school_contacts", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  // Null for a shared program inbox
  name: text("name"),
  title: text("title"),
  // program | head | recruiting | assistant | operations
  role: text("role").notNull(),
  email: text("email"),
  phone: text("phone"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// A coach email an athlete's family added. Shown to them right away; shown to everyone once
// an admin approves it. Kept apart from school_contacts so data syncs never overwrite it.
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  title: text("title"),
  // program | head | recruiting | assistant | operations
  role: text("role").notNull(),
  email: text("email").notNull(),
  // Where the family got it: coach-email | website | camp | other
  source: text("source").notNull(),
  // pending | approved | rejected
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
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
  // When her height was last changed: growing athletes' heights go stale.
  heightUpdatedAt: timestamp("height_updated_at", { withTimezone: true }),
  // Month and year only (no full birth date): her age drives the age-adjusted comparisons.
  birthYear: integer("birth_year"),
  birthMonth: integer("birth_month"),
  // Opt-in: include her measurements and offers (no name or contact details) in VB Elite's
  // anonymous statistics, used to build age-by-position norms and projections.
  researchConsent: boolean("research_consent").notNull().default(false),
  researchConsentAt: timestamp("research_consent_at", { withTimezone: true }),
  homeZip: text("home_zip").notNull(),
  homeCity: text("home_city"),
  homeState: text("home_state"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  // Starting-point questionnaire answers (JSON, see src/lib/questionnaire.ts); private to the account.
  questionnaire: text("questionnaire"),
  questionnaireAt: timestamp("questionnaire_at", { withTimezone: true }),
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

// The athlete's recruiting log: emails sent, coach replies, camp invites, visits, offers.
// Private to her account; drives the per-school status board and "similar schools".
export const recruitingEvents = pgTable("recruiting_events", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  // See EVENT_TYPES in src/lib/recruiting.ts
  type: text("type").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  coachName: text("coach_name"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Every time her measurables change, a dated snapshot with her age then. Her own history, and
// (when she opted in) the raw material for VB Elite's age-by-position norms.
export const athleteMeasurements = pgTable("athlete_measurements", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  ageYears: real("age_years").notNull(),
  // Whether the age came from her birth month/year (exact) or her graduation year (estimated)
  ageExact: boolean("age_exact").notNull(),
  position: text("position").notNull(),
  heightIn: real("height_in"),
  standingReachIn: real("standing_reach_in"),
  blockTouchIn: real("block_touch_in"),
  approachTouchIn: real("approach_touch_in"),
  // profile | questionnaire | coach
  source: text("source").notNull(),
});

// A frozen snapshot of the athlete when she logged an offer or commitment: who offered, at what
// level, and what her measurables, age and club level were at the time. Building toward real
// "girls like her got offers from programs like these" projections.
export const recruitingOutcomes = pgTable("recruiting_outcomes", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  // Deleting the log entry (a mistake) deletes the snapshot too
  eventId: integer("event_id")
    .notNull()
    .unique()
    .references(() => recruitingEvents.id, { onDelete: "cascade" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  // offer | committed
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  gradYear: integer("grad_year").notNull(),
  position: text("position").notNull(),
  ageYears: real("age_years").notNull(),
  ageExact: boolean("age_exact").notNull(),
  heightIn: real("height_in"),
  standingReachIn: real("standing_reach_in"),
  blockTouchIn: real("block_touch_in"),
  approachTouchIn: real("approach_touch_in"),
  // When those measurables were last updated (older = less reliable)
  measuredAt: timestamp("measured_at", { withTimezone: true }),
  // The program's level (1-3 scale) and conference when the offer came
  programLevel: real("program_level"),
  conference: text("conference"),
  // From the questionnaire (or a coach's confirmation) at the time
  clubDivision: text("club_division"),
  clubRole: text("club_role"),
  coachProjection: text("coach_projection"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A link an athlete sends her club or high school coach to confirm her level. The coach
// answers without an account; the response refines the questionnaire's estimate.
export const coachConfirmations = pgTable("coach_confirmations", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  // SHA-256 of the link's token; the raw token is only ever in the link itself
  tokenHash: text("token_hash").notNull().unique(),
  // Who the athlete sent it to, as she entered it
  coachName: text("coach_name").notNull(),
  // club | director | high-school | other
  coachRole: text("coach_role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  // The coach's answers (JSON, see src/lib/coach.ts)
  response: text("response"),
});

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
export type SchoolContact = typeof schoolContacts.$inferSelect;
export type Athlete = typeof athletes.$inferSelect;
