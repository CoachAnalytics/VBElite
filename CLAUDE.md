@AGENTS.md

# VB Elite

- Stack: Next.js App Router + Drizzle ORM + Postgres (embedded PGlite locally when `DATABASE_URL` is unset), Tailwind v4, Recharts.
- All analytics live in `src/lib/analytics.ts` as pure functions with tests. Keep DB access in `src/lib/queries.ts` and mutations in `src/app/actions.ts`.
- Brand: navy `#0c1c36` + gold `#a6884e` (tokens `--brand-navy`, `--brand-gold`; `--accent` is navy in light mode, gold in dark). Logo files are in `public/brand/` (`logo.png` for light backgrounds, `logo-dark.png` for dark); use the `<Logo>` component.
- Chart colors come from the CSS tokens `--series-1..4` in `globals.css` (a validated colorblind-safe order). Keep that order.
- `data/seed/*.json` names real recruits (mostly minors) and is git-ignored. Never commit it or put recruit names in tests or fixtures.
- PWA: `public/sw.js` only serves an offline fallback. Never cache authenticated pages or school data in it; bump `CACHE` when changing precached files.
- Local PGlite allows one process at a time: stop the dev server before running `npm run db:*`.
- Checks before committing: `npm test && npm run typecheck && npm run lint && npm run build`.
