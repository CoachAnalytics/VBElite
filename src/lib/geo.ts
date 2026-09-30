import zipcodes from "zipcodes";

export type Place = { zip?: string; city: string; state: string; latitude: number; longitude: number };

export function lookupZip(zip: string): Place | null {
  const r = zipcodes.lookup(zip.trim());
  if (!r || r.country !== "US") return null;
  return { zip: r.zip, city: r.city, state: r.state, latitude: r.latitude, longitude: r.longitude };
}

export function lookupCity(city: string, state: string): Place | null {
  // "Fairborn (Dayton)" -> "Fairborn"
  const clean = city.replace(/\s*\(.*\)\s*/g, "").trim();
  const hits = zipcodes.lookupByName(clean, state);
  if (!hits.length) return null;
  const lat = hits.reduce((s, h) => s + h.latitude, 0) / hits.length;
  const lon = hits.reduce((s, h) => s + h.longitude, 0) / hits.length;
  return { city: clean, state, latitude: lat, longitude: lon };
}

export { milesBetween } from "./distance";
