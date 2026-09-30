# VB Elite

Volleyball recruiting analytics. Families create an account, enter their athlete's
position, graduation year, height and home ZIP code, pick the colleges they're
interested in, and get a side-by-side comparison:

- **Playing-time outlook**: players at the athlete's position still on each roster in
  their freshman season, plus commits in the classes ahead and in the same class, and a
  four-season timeline.
- **Program strength**: five seasons of records and postseason results, APR, head-coach tenure.
- **Cost and distance**: in-state or out-of-state tuition and straight-line miles, based on the athlete's ZIP code.
- **Fit score**: a 0–100 ranking of the schools on the list, weighted by what the family
  cares about (sliders on the Compare page).

## Run it locally

Requires Node 20+.

```bash
npm install
npm run import:xlsx -- path/to/Volleyball_Recruiting_Comparison.xlsx   # builds data/seed/schools.json
npm run db:setup      # creates the database, loads schools, adds a demo account
npm run dev           # http://localhost:3000
```

Log in as `demo@vbelite.local` / `demo-password`, or sign up as a new user.

With no `DATABASE_URL` set, the app uses an embedded Postgres stored in `./.data`,
so nothing else needs to be installed. Only one process can open it at a time:
**stop `npm run dev` before running `db:*` scripts**. You'll get a clear error if you forget.

## Updating school data

Until automated collectors exist, the research spreadsheet is the source of truth.
On the live site, upload it on the **Admin** page (visible to `ADMIN_EMAILS`). Locally:

1. Edit the workbook (same tabs and column headers as the original).
2. `npm run import:xlsx -- workbook.xlsx` rewrites `data/seed/schools.json`. Options:
   `--division D2` for a workbook of D2 schools, `--home-state OH` for the state the
   tuition column is priced for, and `--season 2026` for the roster year.
   Schools already in the JSON but not in this workbook are kept, so you can import one workbook per division.
3. `npm run db:seed` loads the JSON into the database. It's safe to re-run: each school's
   seasons, roster and commits are replaced.

`data/seed/*.json` is git-ignored on purpose: it names recruits, most of them minors.

The database schema covers every division (D1, D2, D3, NAIA, JUCO) and every position.
`schools.positions_covered` records which positions have roster and commit data. The
first workbook only covers outside hitters, so athletes at other positions see "No data yet"
instead of misleading zeros.

## Deploying (Vercel + Neon Postgres)

1. **Vercel:** sign up at vercel.com with your GitHub account, click **Add New → Project**, and import
   `CoachAnalytics/VBElite`. Leave the defaults and don't deploy yet if it asks; the first deploy fails without a database.
2. **Database:** in the project, open **Storage → Create Database → Neon (Serverless Postgres)**, create it
   (free plan is fine; pick the US East region, the same as Vercel's default), and connect it to the project for all
   environments. This adds `DATABASE_URL` automatically.
3. **Admin access:** under **Settings → Environment Variables**, add `ADMIN_EMAILS` = the email you'll sign up with.
4. **Deploy:** open **Deployments** and redeploy. Every deploy runs `vercel-build`, which applies any
   pending database migrations and then builds the app.
5. **Load the data:** open the site, sign up with the admin email, go to **Admin**, and upload the workbook.
   Re-upload any time the spreadsheet changes.

A custom domain can be added under **Settings → Domains**.

Notes:
- The demo account is never created against a remote database.
- Vercel's free Hobby plan is for non-commercial use. Switch to Pro before charging subscribers.

## Project layout

| Path | What it is |
|---|---|
| `src/lib/analytics.ts` | All the calculations (roster projection, scoring). Pure functions, tested in `analytics.test.ts` |
| `src/db/schema.ts` | Database tables. After changing it, run `npm run db:generate` to create a migration |
| `src/app/` | Pages: `/schools` (browse and add), `/compare` (dashboard), `/schools/[slug]` (school detail), `/profile` |
| `src/app/actions.ts` | Server actions: sign up, log in, save profile, add or remove schools |
| `src/lib/import/` | Workbook parser and database loader (used by the CLI and the admin upload) |
| `src/app/admin/` | Admin page: data upload and status |
| `scripts/` | CLI wrappers: spreadsheet import, migrations, seeding |

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Roadmap

- [x] Accounts, athlete profile, school list with tiers, comparison dashboard, school pages
- [ ] Stripe subscriptions (free tier limited to 3 schools, paid tier unlimited)
- [ ] Load every program's directory, location, enrollment and tuition from the College Scorecard API (all divisions)
- [ ] Scheduled collectors: records and postseason results (NCAA stats), rosters (school athletics sites), APR
- [ ] All positions for rosters and commits, plus an admin review queue for scraped changes
- [ ] Email alerts when a school on your list gets a new commit at your position or changes coach
