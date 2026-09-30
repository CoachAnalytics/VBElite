export const TIERS = [
  { code: "top", label: "Top choice" },
  { code: "main", label: "Main list" },
  { code: "reach", label: "Reach" },
  { code: "expand", label: "Exploring" },
] as const;

export type Tier = (typeof TIERS)[number]["code"];

export function isTier(value: string): value is Tier {
  return TIERS.some((t) => t.code === value);
}

export function tierLabel(code: string): string {
  return TIERS.find((t) => t.code === code)?.label ?? code;
}
