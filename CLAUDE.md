@AGENTS.md

# VB Elite

- Stack: Next.js App Router + Drizzle ORM + Postgres (embedded PGlite locally when `DATABASE_URL` is unset), Tailwind v4, Recharts.
- All analytics live in `src/lib/analytics.ts` as pure functions with tests. Keep DB access in `src/lib/queries.ts` and mutations in `src/app/actions.ts`.
- Chart colors come from the CSS tokens `--series-1..4` in `globals.css` (a validated colorblind-safe order). Keep that order.
- `data/seed/*.json` names real recruits (mostly minors) and is git-ignored. Never commit it or put recruit names in tests or fixtures.
- Local PGlite allows one process at a time: stop the dev server before running `npm run db:*`.
- Checks before committing: `npm test && npm run typecheck && npm run lint && npm run build`.
