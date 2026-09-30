// Shape of data/seed/*.json — the hand-editable source of truth for school data
// until automated collectors take over each field.

export type SeasonSeed = {
  year: number;
  wins: number;
  losses: number;
  postseason: string | null;
};

export type RosterSeed = {
  name: string;
  classYear: "Fr" | "So" | "Jr" | "Sr" | "Grad";
  redshirt: boolean;
  positionRaw: string | null;
  heightIn: number | null;
};

export type CommitSeed = {
  name: string;
  gradYear: number;
  positionRaw: string | null;
  /** Overrides the first listed position, e.g. an "OH/DS/L" who is really a back-row player. */
  primaryPosition?: string | null;
  heightIn: number | null;
  hometown: string | null;
  club: string | null;
  note: string | null;
};

export type SchoolSeed = {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  latitude?: number | null;
  longitude?: number | null;
  division: string;
  conference: string | null;
  control: "public" | "private" | null;
  enrollment: number | null;
  enrollmentNote: string | null;
  tuitionInState: number | null;
  tuitionOutState: number | null;
  tuitionYear: string | null;
  headCoach: string | null;
  coachSince: number | null;
  apr: number | null;
  aprNote: string | null;
  rosterSize: number | null;
  rosterSeason: number | null;
  positionsCovered: string[];
  commitDataQuality: "good" | "partial" | null;
  recruitingNote: string | null;
  programNote: string | null;
  seasons: SeasonSeed[];
  roster: RosterSeed[];
  commits: CommitSeed[];
};
