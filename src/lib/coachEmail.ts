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
  /** Her latest season in one line (see statLine), and her MaxPreps page. */
  statsLine?: string | null;
  maxprepsUrl?: string | null;
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
    ...(athlete.statsLine ? [`Stats: ${athlete.statsLine}`] : []),
    ...(athlete.maxprepsUrl ? [`MaxPreps: ${athlete.maxprepsUrl}`] : []),
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

// ---------- Emails families add ----------

export const CONTACT_SOURCES = [
  { value: "coach-email", label: "The coach emailed us" },
  { value: "website", label: "The school's website" },
  { value: "camp", label: "At a camp, clinic or visit" },
  { value: "other", label: "Somewhere else" },
] as const;

const baseDomain = (host: string) =>
  host.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").split(".").slice(-2).join(".");

/** True when the address is on the school's own domain or its athletics site's domain. */
export function onSchoolDomain(email: string, sites: (string | null | undefined)[]): boolean {
  const domain = email.split("@")[1];
  if (!domain) return false;
  const own = new Set(sites.filter((s): s is string => !!s).map(baseDomain));
  return own.has(baseDomain(domain));
}

export type ShownContact = {
  key: string;
  name: string | null;
  title: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  /** Added by a family: "approved" for everyone, "mine" while only she can see it. */
  added?: "approved" | "mine";
};

/**
 * The school's contacts as shown: the researched list, then approved additions, then her own
 * pending ones. An added email already on the list (by address) isn't repeated; one for a
 * person on the list who has no address of their own fills that gap.
 */
export function mergeContacts(
  official: { id: number; name: string | null; title: string | null; role: string; email: string | null; phone: string | null }[],
  added: { id: number; name: string | null; title: string | null; role: string; email: string; status: string; mine: boolean }[],
): ShownContact[] {
  const out: ShownContact[] = official.map((c) => ({ ...c, key: `c${c.id}` }));
  const has = (email: string) => out.some((c) => c.email?.toLowerCase() === email.toLowerCase());
  const norm = (n: string | null) => n?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  for (const s of added) {
    if (s.status === "rejected" || (s.status !== "approved" && !s.mine) || has(s.email)) continue;
    const tag = s.status === "approved" ? "approved" : "mine";
    const person = s.name ? out.find((c) => !c.email && c.name && norm(c.name) === norm(s.name)) : undefined;
    if (person) {
      person.email = s.email;
      person.added = tag;
    } else {
      out.push({ key: `s${s.id}`, name: s.name, title: s.title, role: s.role, email: s.email, phone: null, added: tag });
    }
  }
  const order: Record<string, number> = { program: 0, head: 1, recruiting: 2, assistant: 3, operations: 4 };
  return out.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
}
