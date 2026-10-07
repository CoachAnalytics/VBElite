import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home Screen"): it opens full screen with
// the VB Elite icon, like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VB Elite — Volleyball recruiting analytics",
    short_name: "VB Elite",
    description: "Compare college volleyball programs against your recruit's position, class and goals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcfcfb",
    theme_color: "#0c1c36",
    categories: ["sports", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
