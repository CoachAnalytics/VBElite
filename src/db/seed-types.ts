// Shape of data/seed/*.json — the hand-editable source of truth for school data
// until automated collectors take over each field.

export type SeasonSeed = {
  year: number;
  wins: number | null;
  losses: number | null;
  postseason: string | null;
  ncaaSeed?: number | null;
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
  highSchool?: string | null;
  hometown: string | null;
  club: string | null;
  note: string | null;
  source?: string | null;
};

export type SchoolSeed = {
  slug: string;
  name: string;
  ncaaOrgId?: number | null;
  scorecardUnitId?: number | null;
  officialName?: string | null;
  team?: string | null;
  website?: string | null;
  athleticsWebsite?: string | null;
  admissionRate?: number | null;
  satAvg?: number | null;
  act25?: number | null;
  act75?: number | null;
  costOfAttendance?: number | null;
  avgNetPrice?: number | null;
  graduationRate?: number | null;
  retentionRate?: number | null;
  medianEarnings?: number | null;
  studentFacultyRatio?: number | null;
  researchedAt?: string | null;
  sources?: string[] | null;
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
