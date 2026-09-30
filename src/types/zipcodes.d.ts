declare module "zipcodes" {
  export type ZipInfo = {
    zip: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
  };
  export function lookup(zip: string | number): ZipInfo | undefined;
  export function lookupByName(city: string, state: string): ZipInfo[];
  const _default: { lookup: typeof lookup; lookupByName: typeof lookupByName };
  export default _default;
}
