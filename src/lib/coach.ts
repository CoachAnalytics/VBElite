/**
 * Coach confirmation: the questions a club or high school coach answers through the
 * athlete's link, and how a response is read. No database access here.
 */
import { z } from "zod";

export const COACH_ROLES = [
  { value: "club", label: "Club coach" },
  { value: "director", label: "Club director" },
  { value: "high-school", label: "High school coach" },
  { value: "other", label: "Other coach or trainer" },
] as const;

// Same values as the questionnaire's coach projection, so they can replace it.
export const LEVELS = [
  { value: "high", label: "Top D1 (Power conferences, top-25 programs)" },
  { value: "mid", label: "Mid-level D1" },
  { value: "low", label: "Lower-conference D1" },
  { value: "d2", label: "D2" },
  { value: "d3", label: "D3 or NAIA" },
] as const;

export const ROLES = [
  { value: "starter-all", label: "Starter, plays all rotations" },
  { value: "starter", label: "Starter" },
  { value: "rotation", label: "Rotates in" },
  { value: "developing", label: "Developing / limited minutes" },
] as const;

export const LINK_DAYS = 30;

const values = <T extends readonly { value: string }[]>(xs: T) => xs.map((x) => x.value) as [T[number]["value"], ...T[number]["value"][]];

export const responseSchema = z.object({
  coachName: z.string().trim().min(2, "Enter your name").max(80),
  club: z.string().trim().max(80),
  level: z.enum(values(LEVELS), { message: "Choose the level you think she can play" }),
  role: z.enum(values(ROLES), { message: "Choose her role on your team" }),
  // Null when the coach says the listed height is right.
  heightIn: z.number().int().min(56).max(84).nullable(),
  note: z.string().trim().max(600),
});

export type CoachResponse = z.infer<typeof responseSchema>;

export function parseResponse(json: string | null | undefined): CoachResponse | null {
  if (!json) return null;
  try {
    const parsed = responseSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function levelText(value: string): string {
  return LEVELS.find((l) => l.value === value)?.label ?? value;
}

export function roleText(value: string): string {
  return COACH_ROLES.find((r) => r.value === value)?.label ?? value;
}

/** A confirmed coach response, as the recommender uses it. */
export type CoachConfirmation = {
  level: string;
  /** Her role on the coach's team (same values as the questionnaire's club role). */
  role: string;
  coachName: string;
  coachRole: string;
  club: string;
  heightIn: number | null;
  respondedAt: Date;
};
