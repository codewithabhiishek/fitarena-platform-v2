# FitArena ⚡

Elite Gym Challenges — a mobile-first Next.js app with Supabase backend.

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in Supabase and server-only keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only key used after QR token verification |
| `UNLOCK_TOKEN_SECRET` | ✅ | Server-only QR signing key (`openssl rand -hex 32`) |
| `GROQ_API_KEY` | Optional | Enables AI motivational text |

---

## Database Setup

1. Go to **Supabase Dashboard → SQL Editor → New query**
2. Paste the contents of `src/supabase/schema.sql`
3. Click **Run**

Run the full schema again when upgrading an existing FitArena database. It
removes the older client-writable policies and replaces vulnerable RPCs.

This creates:
- `users` table (auto-populated on signup via trigger)
- `challenges` table
- `submissions` table (with unique constraint: 1 per user per challenge per day)
- protected `leaderboard` view (authenticated members only)
- atomic reward and submission-review RPCs
- All Row-Level Security (RLS) policies
- token-verified challenge unlocking

---

## Google OAuth Setup

1. Supabase Dashboard → **Authentication → Providers → Google** → Enable
2. Add your Google OAuth credentials
3. Add redirect URLs under **Authentication → URL Configuration**:
   - `http://localhost:3000` (development)
   - `https://your-production-domain.com` (production)

---

## Architecture

```
src/
  app/              Next.js app router (page.js, layout.js, globals.css)
  components/
    FitArena.jsx    Single-page app — all screens rendered here
  hooks/
    useAuth.js      Auth state (session, user, loading, signOut)
    useProfile.js   Current user's DB profile + leaderboard position
    useChallenges.js  Active challenges enriched with real submission stats
    useLeaderboard.js Real-time leaderboard from Supabase view
  services/
    authService.js      signUp, signIn, Google OAuth, signOut
    userService.js      profile CRUD, avatar upload, leaderboard fetch
    challengeService.js challenge CRUD, stats aggregation, real-time sub
    submissionService.js score submit, proof upload, admin approve/reject
  supabase/
    client.js       Shared Supabase client (singleton)
    schema.sql      Complete DB schema — run once in SQL Editor
```

---

## What's Real vs Static

| Feature | Data Source |
|---|---|
| Auth (email, Google) | Supabase Auth |
| User profile | `public.users` table |
| Leaderboard | `public.leaderboard` view (real-time) |
| Challenges | `public.challenges` table (real-time) |
| Submissions | `public.submissions` table |
| Challenge stats (top score, participants) | Aggregated from `submissions` |
| My best score per challenge | Aggregated from approved `submissions` |
| Badges display | Static config (BADGES map in FitArena.jsx) |
| Rewards store | Static config (REWARDS array in FitArena.jsx) |
| AI quotes | Groq API (falls back to hardcoded quotes) |

---

## Known Remaining Items

1. **Leaderboard periods** — tabs currently filter members active during the
   selected period; they do not calculate points earned within that period.

2. **Leaderboard "change" arrows** — Always show "—" (same). Needs a
   `leaderboard_snapshots` table to compare current vs. previous period.

3. **Email confirmation** — If Supabase email confirmation is enabled, users
   see a "Check your email" screen after signup. Make sure your Supabase
   project's email templates are configured.
