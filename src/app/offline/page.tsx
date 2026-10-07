import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline — VB Elite" };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-sm space-y-3 pt-16 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="text-ink-2">VB Elite needs an internet connection to load the latest school data.</p>
      {/* A plain link (not next/link) so the browser does a full reload once back online. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn-primary">Try again</a>
    </div>
  );
}
