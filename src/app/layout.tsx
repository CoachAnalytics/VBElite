import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { logout } from "./actions";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { BottomNav } from "@/components/BottomNav";
import { InstallHint, ServiceWorkerRegistration } from "@/components/pwa";
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
  applicationName: "VB Elite",
  // iOS home-screen app: full screen, named "VB Elite" under the icon.
  appleWebApp: { capable: true, title: "VB Elite", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the tab bar sit behind the iPhone home indicator, padded by safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c1c36" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* On phones, leave room for the fixed tab bar (and the iPhone home indicator). */}
      <body className={`flex min-h-full flex-col ${user ? "pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0" : ""}`}>
        <header className="border-b-2 border-gold">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm sm:gap-x-6">
            <Link href="/" aria-label="VB Elite home" className="-my-1 shrink-0">
              <Logo height={36} priority />
            </Link>
            {user ? (
              <>
                <Link href="/compare" className="hidden text-ink-2 hover:text-ink sm:inline">Compare</Link>
                <Link href="/schools" className="hidden text-ink-2 hover:text-ink sm:inline">Schools</Link>
                <Link href="/profile" className="hidden text-ink-2 hover:text-ink sm:inline">Athlete profile</Link>
                {isAdmin(user) && <Link href="/admin" className="text-ink-2 hover:text-ink">Admin</Link>}
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
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-ink-3">
          Data compiled from official athletics sites, NCAA and public commitment trackers. Verify with coaches before deciding.
        </footer>
        {user && <BottomNav />}
        <InstallHint aboveTabBar={!!user} />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
