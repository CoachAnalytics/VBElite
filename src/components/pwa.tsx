"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Registers the service worker (production only, so local development never serves stale pages). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

// ---- "Add to Home Screen" hint ----

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "vbelite.installHint.dismissed";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let deferredPrompt: InstallPromptEvent | null = null;
let dismissedInMemory = false;

if (typeof window !== "undefined") {
  // Chrome/Edge/Android fire this when the site is installable; keep it to show our own button.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function isDismissed() {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  dismissedInMemory = true;
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {}
  notify();
}

type HintKind = "none" | "ios" | "prompt";

function currentHint(): HintKind {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || isDismissed()) return "none";
  if (deferredPrompt) return "prompt";
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // Only Safari can add to the home screen on older iOS; other iOS browsers show the same Share menu on 16.4+.
  return iOS ? "ios" : "none";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function InstallHint({ aboveTabBar }: { aboveTabBar: boolean }) {
  const hint = useSyncExternalStore(subscribe, currentHint, () => "none" as HintKind);
  if (hint === "none") return null;

  return (
    <div
      role="region"
      aria-label="Install VB Elite"
      className="fixed inset-x-3 z-40 rounded-lg border border-line bg-surface p-3 shadow-lg sm:hidden"
      style={{ bottom: `calc(${aboveTabBar ? "4.5rem" : "1rem"} + env(safe-area-inset-bottom))` }}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Add VB Elite to your home screen</p>
          {hint === "ios" ? (
            <p className="mt-0.5 text-ink-2">
              Tap <ShareIcon /> <b>Share</b>, then <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="mt-0.5 text-ink-2">It opens full screen, like an app.</p>
          )}
        </div>
        <button onClick={dismiss} className="-m-1 p-1 text-ink-3 hover:text-ink" aria-label="Dismiss">
          ✕
        </button>
      </div>
      {hint === "prompt" && (
        <button
          className="btn-primary mt-3 w-full"
          onClick={async () => {
            const e = deferredPrompt;
            if (!e) return;
            await e.prompt();
            await e.userChoice.catch(() => null);
            deferredPrompt = null;
            notify();
          }}
        >
          Install app
        </button>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="inline-block align-text-bottom">
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
