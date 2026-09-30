import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const FEATURES = [
  {
    title: "Playing-time outlook",
    body: "See how many players at your position will still be on each roster when you arrive, including commits in the classes ahead of you.",
  },
  {
    title: "Program strength",
    body: "Five seasons of records, postseason results, APR and head-coach tenure for every school on your list.",
  },
  {
    title: "Cost and distance from your home",
    body: "In-state vs. out-of-state tuition and distance, calculated from your own ZIP code.",
  },
  {
    title: "A fit score you control",
    body: "Weight what matters to your family and every school is ranked side by side, with the math shown.",
  },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/compare");
  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-4 pt-6">
        <h1 className="text-4xl font-semibold tracking-tight">
          Find the college volleyball programs where your recruit fits.
        </h1>
        <p className="text-lg text-ink-2">
          Enter the athlete&apos;s position, class and hometown, pick the schools you&apos;re interested in, and get a
          side-by-side breakdown of rosters, recruiting classes, results and cost. D1, D2, D3, NAIA and JUCO.
        </p>
        <div className="flex gap-3">
          <Link href="/signup" className="btn-primary">Create a free account</Link>
          <Link href="/login" className="btn-secondary">Log in</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
