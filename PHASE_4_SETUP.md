# Phase 4 — Supabase Shared Scoring Setup

This phase replaces per-phone local state with one shared outing in Supabase. The *same React app* still runs on GitHub Pages; no Express/Node server or paid service is required for a small golf outing under current Free-plan allowances.

> **Do not delete your previous browser data yet.** If you entered a roster, pairings, or scores during Phases 2–3, **export a JSON backup before connecting Supabase**. The shared project starts with the default empty 16-match outing.

## 1. Save your Phase 3 setup, if any

1. Run the Phase 3 app (or this Phase 4 app **without** `.env.local`) on the original browser where you entered scores.
2. **Organize → Format & backup → Export setup**. Save `okayest-golf-outing-backup.json`.
3. Keep that JSON until you have verified the Supabase import. This is a backup of outing *scores and rosters*, **not player PINs**.

## 2. Create your free Supabase project

1. Visit https://supabase.com/dashboard and create a project.
2. Wait until the database is provisioned.
3. Open **SQL Editor** and paste the contents of `database/01_phase4_supabase.sql`.
4. **Before executing:** find `CHANGE_THIS_TO_YOUR_PRIVATE_ORGANIZER_PIN` in the SQL file and replace **only the assigned PIN value** on the `declare pin text := ...` line with a strong, private PIN/password of at least 8 characters (12+ recommended). Avoid single quotes inside your chosen PIN, or escape them as two single quotes. **Do not paste your PIN into React files, GitHub, or `.env`**.
5. Run the SQL **once**. Successful completion creates the private credential/session tables, score state, RPC permissions, and public Realtime revision stream.
6. Keep the SQL file unmodified in version control: **revert the organizer PIN back to the placeholder before committing**. The script deliberately refuses to initialize a new organizer while the placeholder is unchanged.

**Existing project:** Re-running the migration with an organizer already configured does not replace that organizer PIN, roster, or scores. The default data insertion is `ON CONFLICT DO NOTHING`.

### Security summary

- Anyone with the link can **view** roster, matches, standings, and scores. This is intentional. Do not add personal contact details to golfer names.
- Golfer and organizer PINs are stored as salted bcrypt hashes in the private Postgres schema, not in the React bundle or public outing JSON.
- Login attempts are rate-limited per identity; sessions last up to seven days and are revoked when that golfer's PIN changes.
- All edits are server-authorized inside restricted SQL functions, even if someone bypasses the React UI.
- A golfer can change only matches containing their golfer ID. The organizer can change the roster and scores.
- This uses a small **custom PIN/session system**, not Supabase Auth email accounts. For higher-stakes applications, use Supabase Auth.

## 3. Connect the React app locally

1. In Supabase, find your **Project URL** and **Publishable Key** in the **Connect** dialog or **Settings → API Keys**. Use the `sb_publishable_...` key, **never `sb_secret_...`, service_role, or your database password**.
2. Copy `.env.example` to `.env.local` in the same folder as `package.json`.
3. Replace the sample project URL and sample publishable key in `.env.local` with your own.
4. Run `npm start`. Restart `npm start` any time you change `.env.local`.
5. The app's thin status bar should say **Live scoring connected**, and **Organize** should request the organizer PIN.

The environment variable values are **public build-time client settings**. Do not put secret/server credentials in them. `.env.local` is ignored by standard Create React App `.gitignore` rules; double-check before pushing.

If the SQL/RPC setup fails, the cloud-connected app shows a connection error; it deliberately **does not silently fall back to a separate local scorecard**.

## 4. Organize the outing and issue golfer PINs

1. Choose **Organize → Organizer → PIN** and sign in with the PIN you created in SQL.
2. Go to **Golfers** and add player names and teams, or if you exported a Phase 3 backup go to **Format & backup → Import setup**. **This replaces the ENTIRE shared outing**; do this only once, before everyone starts scoring.
3. Return to **Golfers → Golfer sign-in PINs**, select each player and assign a private **6–12 digit PIN**. Give golfers only their own PINs.
4. Configure Round 1 (Singles), Round 2 (Alternate Shot), and Round 3 (Scramble) pairings in **Matchups**.
5. Open an incognito/private window or second device. Without signing in, scores are visible but editing is disabled. Sign in as a golfer and check that only that golfer's matches can be edited.

## 5. Multi-phone test

1. Open the site in Phone A as a participating golfer and Phone B as another golfer or spectator.
2. Score Hole 1 on Phone A. The score should appear on Phone B automatically (usually instantly by Realtime, otherwise within ~6 seconds when online).
3. Verify an unrelated golfer can **view** but cannot **edit** that scorecard.
4. Score five winning holes in a Singles match and finalize it. Verify the standings award the configured points once.
5. Reopen the result, correct a stroke, finalize again, and verify the standings change.
6. Simulate two golfers editing the same hole simultaneously. One stale write should be rejected with a conflict message and refreshed from the server instead of silently overwriting the other golfer.
7. Test a phone with spotty Wi-Fi. A connection or save error must be resolved before assuming a score is official.

**Important:** Supabase Free projects may pause after inactivity. Open and test the app at least a day before tee time.

## 6. Deploy via GitHub Pages (GitHub Actions)

Phase 4 includes `.github/workflows/deploy-pages.yml`; no `gh-pages` npm package is required.

1. Push the changed files into the repository's `main` branch.
2. In GitHub **Settings → Secrets and variables → Actions → Variables**, create:
   - `REACT_APP_SUPABASE_URL` = your public project URL
   - `REACT_APP_SUPABASE_PUBLISHABLE_KEY` = your **publishable** key
3. In GitHub **Settings → Pages → Build and deployment**, select **GitHub Actions**.
4. Go to **Actions** and run `Deploy Okayest Golf Outing`, or push to `main`.
5. Open `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/` on two phones. Use the actual username/repository name (case matters).

The workflow sets the Create React App `PUBLIC_URL` to `/REPOSITORY_NAME`, so artwork and JS assets work at a GitHub Pages project subpath. This assumes the default `main` branch; change the workflow if your branch has another name. If you instead publish at a custom domain or user root URL, adjust `PUBLIC_URL` accordingly.

## Troubleshooting

- **"Connection unavailable"**: Verify Supabase URL, publishable key, project status, and that SQL completed. Open browser developer tools for the full RPC error.
- **"Could not find the function"**: Run `notify pgrst, 'reload schema';` in SQL Editor and refresh the site.
- **"Incorrect organizer PIN"**: The organizer PIN is the value entered in the SQL Editor, **not** the golfer PIN. Re-running the initial SQL does not change the existing PIN.
- **No live messages**: Confirm `public.okayest_updates` appears under `supabase_realtime` publication. Polling every ~6 seconds is an intentional fallback.
- **"Another golfer updated"**: A concurrent edit won. Review the refreshed scorecard, then re-enter the intended stroke if needed.
- **"Outing changed on another phone"**: The organizer tried to replace an out-of-date outing. Review refreshed data before retrying.
- **Scores missing after enabling `.env.local`**: Local Phase 3 scores are a **different dataset**. Export the local backup with Supabase disabled, then import via the signed-in organizer.
- **No build on GitHub**: Check that the repository contains `package-lock.json` and that GitHub Actions is enabled for the repository.

## Privacy & limitations

Anyone with your public GitHub Pages link can view the scoring data and names. The organizer and golfer session tokens are held in the browser's localStorage, so treat shared/unlocked phones as signed-in sessions and **sign out when sharing a device**. No scores are queued offline—an offline write will fail and must be retried online. This is an event scoring tool, not a payment-grade identity solution.
