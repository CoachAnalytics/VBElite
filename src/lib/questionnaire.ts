/**
 * The starting-point questionnaire: question definitions shared by the form, the
 * server-side check and the recommender. Answers are stored as JSON on the athlete.
 * Grad year, position, height and ZIP already come from the athlete profile.
 */
import { z } from "zod";

export type Option = { value: string; label: string; hint?: string };
export type Question = {
  /** A key of Answers (checked by answersSchema). */
  id: string;
  label: string;
  help?: string;
  kind: "choice" | "multi" | "height" | "text" | "number";
  options?: Option[];
  optional?: boolean;
  placeholder?: string;
  /** Only asked of athletes at these positions (e.g. setters). */
  positions?: string[];
};
export type Step = { title: string; intro: string; questions: Question[] };

const IMPORTANCE: Option[] = [
  { value: "0", label: "Not important" },
  { value: "1", label: "Somewhat" },
  { value: "2", label: "Very" },
  { value: "3", label: "Top priority" },
];

export const REGIONS: Option[] = [
  { value: "northeast", label: "Northeast" },
  { value: "southeast", label: "Southeast" },
  { value: "midwest", label: "Midwest" },
  { value: "south", label: "Texas & South Central" },
  { value: "mountain", label: "Mountain West" },
  { value: "pacific", label: "West Coast" },
];

export const STEPS: Step[] = [
  {
    title: "Measurables",
    intro: "College coaches recruit on reach and jump as much as height. Leave anything blank you haven't measured.",
    questions: [
      { id: "standingReach", label: "Standing reach", kind: "height", optional: true, placeholder: `e.g. 7'8"`, help: "Flat-footed, one arm up." },
      { id: "approachTouch", label: "Approach touch", kind: "height", optional: true, placeholder: `e.g. 9'10"`, help: "Highest touch with a full approach jump." },
      { id: "blockTouch", label: "Block touch", kind: "height", optional: true, placeholder: `e.g. 9'4"` },
      {
        id: "hand",
        label: "Hitting hand",
        kind: "choice",
        options: [
          { value: "right", label: "Right" },
          { value: "left", label: "Left", hint: "Lefties are valued at opposite" },
        ],
      },
      {
        id: "secondPosition",
        label: "Second position",
        kind: "choice",
        optional: true,
        options: [
          { value: "", label: "None" },
          { value: "S", label: "Setter" },
          { value: "OH", label: "Outside" },
          { value: "OPP", label: "Opposite" },
          { value: "MB", label: "Middle" },
          { value: "LDS", label: "Libero / DS" },
        ],
      },
    ],
  },
  {
    title: "Volleyball",
    intro: "Be honest: these answers decide which programs are a realistic fit.",
    questions: [
      {
        id: "clubDivision",
        label: "Club team's level this season",
        kind: "choice",
        options: [
          { value: "open", label: "Open / National", hint: "Top bracket at national qualifiers" },
          { value: "usa", label: "USA" },
          { value: "american", label: "American" },
          { value: "regional", label: "Patriot, Liberty or regional only" },
          { value: "none", label: "No club team" },
        ],
      },
      {
        id: "clubFinish",
        label: "Club team's best result last season",
        kind: "choice",
        options: [
          { value: "medal", label: "Medaled at nationals" },
          { value: "nationals", label: "Played at nationals" },
          { value: "qualifier", label: "Played national qualifiers" },
          { value: "regional", label: "Regional events only" },
          { value: "none", label: "Didn't play club" },
        ],
      },
      {
        id: "clubRole",
        label: "Role on the club team",
        kind: "choice",
        options: [
          { value: "starter-all", label: "Starter, plays all rotations" },
          { value: "starter", label: "Starter" },
          { value: "rotation", label: "Rotates in" },
          { value: "developing", label: "Developing / limited minutes" },
        ],
      },
      {
        id: "hsRole",
        label: "High school team",
        kind: "choice",
        options: [
          { value: "varsity-starter", label: "Varsity starter" },
          { value: "varsity", label: "Varsity" },
          { value: "jv", label: "JV / freshman" },
          { value: "none", label: "Doesn't play high school" },
        ],
      },
      {
        id: "yearsClub",
        label: "Years of club volleyball",
        kind: "choice",
        options: [
          { value: "1", label: "1 or less" },
          { value: "2", label: "2–3" },
          { value: "4", label: "4–5" },
          { value: "6", label: "6+" },
        ],
      },
      {
        id: "coachProjection",
        label: "What level does her club coach or director think she can play?",
        help: "Ask them directly. It's the most useful answer in this questionnaire.",
        kind: "choice",
        options: [
          { value: "high", label: "Top D1 (Power conferences, top-25 programs)" },
          { value: "mid", label: "Mid-level D1" },
          { value: "low", label: "Lower-conference D1" },
          { value: "d2", label: "D2" },
          { value: "d3", label: "D3 or NAIA" },
          { value: "unknown", label: "We haven't asked yet" },
        ],
      },
      {
        id: "contact",
        label: "College interest so far",
        kind: "choice",
        options: [
          { value: "none", label: "None yet" },
          { value: "camps", label: "Camp or clinic invitations" },
          { value: "talks", label: "Ongoing conversations with coaches" },
          { value: "offers", label: "Has an offer" },
        ],
      },
      { id: "video", label: "Highlight video link", kind: "text", optional: true, placeholder: "https://…" },
    ],
  },
  {
    title: "Academics",
    intro: "Used to match schools where she'll be admitted and comfortable academically.",
    questions: [
      {
        id: "gpa",
        label: "Unweighted GPA",
        kind: "choice",
        options: [
          { value: "3.8", label: "3.8 – 4.0" },
          { value: "3.5", label: "3.5 – 3.79" },
          { value: "3.0", label: "3.0 – 3.49" },
          { value: "2.5", label: "2.5 – 2.99" },
          { value: "2.0", label: "Below 2.5" },
        ],
      },
      { id: "sat", label: "SAT score (or ACT converted)", kind: "number", optional: true, placeholder: "e.g. 1250" },
    ],
  },
  {
    title: "Priorities",
    intro: "What matters most in a college? These also set the weights on your Compare page.",
    questions: [
      { id: "wantPlayingTime", label: "Playing time early in college", kind: "choice", options: IMPORTANCE },
      {
        id: "setterSystem",
        label: "As a setter: a 5-1 or a 6-2 offense?",
        help: "In a 6-2, two setters play (each sets from the back row), so there are more chances for a setter to see the court. In a 5-1, one setter runs the offense in all six rotations.",
        kind: "choice",
        positions: ["S"],
        options: [
          { value: "6-2", label: "Prefer a 6-2", hint: "More setting opportunities to play" },
          { value: "5-1", label: "Prefer a 5-1", hint: "She wants to run the whole offense" },
          { value: "either", label: "No preference" },
        ],
      },
      { id: "wantWinning", label: "Competing for championships", kind: "choice", options: IMPORTANCE },
      { id: "wantAcademics", label: "Academic reputation", kind: "choice", options: IMPORTANCE },
      { id: "wantCost", label: "Keeping cost down", kind: "choice", options: IMPORTANCE },
      {
        id: "maxDistance",
        label: "How far from home?",
        kind: "choice",
        options: [
          { value: "250", label: "Within a few hours' drive" },
          { value: "600", label: "A day's drive" },
          { value: "1200", label: "A short flight" },
          { value: "0", label: "Anywhere" },
        ],
      },
      { id: "regions", label: "Regions she'd like (choose any)", kind: "multi", options: REGIONS, optional: true },
      {
        id: "size",
        label: "School size",
        kind: "choice",
        options: [
          { value: "small", label: "Small (under 5,000)" },
          { value: "medium", label: "Medium (5,000–15,000)" },
          { value: "large", label: "Large (15,000+)" },
          { value: "any", label: "No preference" },
        ],
      },
      {
        id: "control",
        label: "Public or private",
        kind: "choice",
        options: [
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
          { value: "any", label: "Either" },
        ],
      },
    ],
  },
];

/** The steps with only the questions asked of an athlete at this position. */
export function stepsFor(position: string | null | undefined): Step[] {
  return STEPS.map((s) => ({ ...s, questions: s.questions.filter((q) => !q.positions || (position != null && q.positions.includes(position))) }));
}

export const questionCount = (position: string | null | undefined) => stepsFor(position).reduce((n, s) => n + s.questions.length, 0);

const choice = (q: string[]) => z.enum(q as [string, ...string[]]);
const opts = (id: string): string[] => STEPS.flatMap((s) => s.questions).find((q) => q.id === id)!.options!.map((o) => o.value);
const inches = z.number().multipleOf(0.5).min(60).max(150).nullable();

export const answersSchema = z.object({
  standingReach: inches,
  approachTouch: inches,
  blockTouch: inches,
  hand: choice(opts("hand")),
  secondPosition: z.string().max(4),
  clubDivision: choice(opts("clubDivision")),
  clubFinish: choice(opts("clubFinish")),
  clubRole: choice(opts("clubRole")),
  hsRole: choice(opts("hsRole")),
  yearsClub: choice(opts("yearsClub")),
  coachProjection: choice(opts("coachProjection")),
  contact: choice(opts("contact")),
  video: z.union([z.literal(""), z.string().url().max(300)]),
  gpa: choice(opts("gpa")),
  sat: z.number().int().min(400).max(1600).nullable(),
  wantPlayingTime: choice(opts("wantPlayingTime")),
  // Setters only; absent in answers saved before it was added.
  setterSystem: choice(opts("setterSystem")).optional(),
  wantWinning: choice(opts("wantWinning")),
  wantAcademics: choice(opts("wantAcademics")),
  wantCost: choice(opts("wantCost")),
  maxDistance: choice(opts("maxDistance")),
  regions: z.array(choice(REGIONS.map((r) => r.value))),
  size: choice(opts("size")),
  control: choice(opts("control")),
});

export type Answers = z.infer<typeof answersSchema>;

export function parseAnswers(json: string | null | undefined): Answers | null {
  if (!json) return null;
  try {
    const parsed = answersSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const STATE_REGION: Record<string, string> = {};
const add = (region: string, states: string) => states.split(" ").forEach((s) => (STATE_REGION[s] = region));
add("northeast", "ME NH VT MA RI CT NY NJ PA DE MD DC");
add("southeast", "VA WV NC SC GA FL KY TN AL MS");
add("midwest", "OH MI IN IL WI MN IA MO ND SD NE KS");
add("south", "TX OK AR LA");
add("mountain", "MT ID WY CO UT NV AZ NM");
add("pacific", "WA OR CA AK HI");

export function regionOf(state: string | null): string | null {
  return state ? (STATE_REGION[state] ?? null) : null;
}
