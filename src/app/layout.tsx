import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { logout } from "./actions";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VB Elite — Volleyball recruiting analytics",
  description: "Compare college volleyball programs against your recruit's position, class and goals.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-semibold tracking-tight">
              VB Elite
            </Link>
            {user ? (
              <>
                <Link href="/compare" className="text-ink-2 hover:text-ink">Compare</Link>
                <Link href="/schools" className="text-ink-2 hover:text-ink">Schools</Link>
                <Link href="/profile" className="text-ink-2 hover:text-ink">Athlete profile</Link>
                <form action={logout} className="ml-auto">
                  <button className="text-ink-3 hover:text-ink">Log out</button>
                </form>
              </>
            ) : (
              <div className="ml-auto flex items-center gap-4">
                <Link href="/login" className="text-ink-2 hover:text-ink">Log in</Link>
                <Link href="/signup" className="btn-primary">Get started</Link>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-ink-3">
          Data compiled from official athletics sites, NCAA and public commitment trackers. Verify with coaches before deciding.
        </footer>
      </body>
    </html>
  );
}
