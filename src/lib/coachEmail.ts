/**
 * The intro email a recruit sends a college coach, pre-filled from her profile, and the
 * mailto: link that opens it in her mail app. Pure functions, no database access.
 */
import { formatHeight } from "./format";
import { positionLabel } from "./positions";

export type ContactRole = "program" | "head" | "recruiting" | "assistant" | "operations";

export const ROLE_LABEL: Record<string, string> = {
  program: "Program inbox",
  head: "Head coach",
  recruiting: "Recruiting coordinator",
  assistant: "Assistant coach",
  operations: "Operations",
};

export type EmailAthlete = {
  name: string;
  gradYear: number;
  position: string;
  heightIn: number | null;
  homeCity: string | null;
  homeState: string | null;
  video?: string | null;
};

/** "Coach Lee" from "Pat Lee" (and "Coach" for a shared inbox or unknown name). */
export function greetingName(name: string | null): string {
  const last = name?.replace(/,.*$/, "").trim().split(/\s+/).filter(Boolean).at(-1);
  return last ? `Coach ${last}` : "Coach";
}

export function coachEmail(athlete: EmailAthlete, schoolName: string, coachName: string | null) {
  const pos = positionLabel(athlete.position);
  const height = athlete.heightIn ? formatHeight(athlete.heightIn) : null;
  const from = [athlete.homeCity, athlete.homeState].filter(Boolean).join(", ");
  const subject = [athlete.name, `Class of ${athlete.gradYear} ${pos}`, height].filter(Boolean).join(" | ");
  const intro = `My name is ${athlete.name}, a Class of ${athlete.gradYear} ${pos.toLowerCase()}${height ? ` (${height})` : ""}${from ? ` from ${from}` : ""}.`;
  const body = [
    `Hi ${greetingName(coachName)},`,
    "",
    `${intro} I'm very interested in ${schoolName} volleyball and would love to learn more about your program.`,
    "",
    "Club team and jersey number: [add]",
    "Upcoming tournaments where you can see me play: [add]",
    `Highlight video: ${athlete.video || "[add link]"}`,
    "GPA / test scores: [add]",
    "",
    "Thank you for your time. I look forward to hearing from you.",
    "",
    athlete.name,
  ].join("\n");
  return { subject, body };
}

export function mailtoLink(to: string, subject: string, body: string): string {
  // encodeURIComponent keeps line breaks (%0A), which mail apps turn back into new lines.
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
