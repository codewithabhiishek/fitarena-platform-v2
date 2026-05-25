# FitArena — Setup & Deployment Guide

Everything you need to go from zip file to live production app.

---

## 1. Install Dependencies

```bash
npm install
```

This installs Next.js, Supabase, Sentry, and all other packages listed in `package.json`.

---

## 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in each value (see sections below for where to find them).

Generate the QR signing secret once:

```bash
openssl rand -hex 32
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and `UNLOCK_TOKEN_SECRET` server-only. Never
prefix them with `NEXT_PUBLIC_`.

---

## 3. Apply the Database Schema

In **Supabase Dashboard -> SQL Editor**, run the complete contents of
`src/supabase/schema.sql`. Re-run this full schema for existing deployments:
it removes insecure legacy policies and updates the protected RPCs.

---

## 4. Set Up Sentry (Error Tracking)

Sentry captures crashes and errors automatically in production. Setup takes about 3 minutes.

### Step 1 — Create a Sentry account and project

1. Go to [sentry.io](https://sentry.io) and sign up for a free account
2. Click **Create Project**
3. Select **Next.js** as the platform
4. Give it a name (e.g. `fitarena`) and click **Create Project**

### Step 2 — Get your DSN

1. In your new project, go to **Settings → Client Keys (DSN)**
2. Copy the DSN string (looks like `https://abc123@o123456.ingest.sentry.io/789`)
3. Paste it as `NEXT_PUBLIC_SENTRY_DSN` in your `.env.local`

### Step 3 — Get your org and project slugs

Look at your browser URL bar on any Sentry page:

```
https://sentry.io/organizations/YOUR-ORG-SLUG/projects/YOUR-PROJECT-SLUG/
```

- Copy `YOUR-ORG-SLUG` → paste as `SENTRY_ORG` in `.env.local`
- Copy `YOUR-PROJECT-SLUG` → paste as `SENTRY_PROJECT` in `.env.local`

### Step 4 — Get an auth token (for source map uploads)

1. Go to **User Settings → Auth Tokens** (top-right avatar → User Settings)
2. Click **Create New Token**
3. Give it a name, select the `project:releases` scope
4. Click **Create Token** and copy it
5. Paste as `SENTRY_AUTH_TOKEN` in `.env.local`

Your `.env.local` Sentry section should now look like:

```
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=fitarena
SENTRY_AUTH_TOKEN=sntrys_...
```

---

## 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Sentry is disabled in development (`NODE_ENV !== "production"`) so you won't see errors in your Sentry dashboard while running locally. This is intentional — it keeps your dev noise out of production monitoring.

---

## 6. Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git init          # if not already a git repo
git add .
git commit -m "Initial FitArena deploy"
git remote add origin https://github.com/YOUR-USERNAME/fitarena.git
git push -u origin main
```

### Step 2 — Import on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (or sign up — it's free)
2. Click **Add New → Project**
3. Select your GitHub repo
4. Leave the default build settings (Vercel auto-detects Next.js)
5. **Before clicking Deploy**, add your environment variables (see next step)

### Step 3 — Add environment variables in Vercel

In the Vercel project setup screen, click **Environment Variables** and add every variable from your `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API (server-only) |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `UNLOCK_TOKEN_SECRET` | Output from `openssl rand -hex 32` (server-only) |
| `RATE_LIMIT_DISABLED` | Set to `false` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project Settings → Client Keys |
| `SENTRY_ORG` | Your Sentry org slug |
| `SENTRY_PROJECT` | Your Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Sentry → User Settings → Auth Tokens |

### Step 4 — Deploy

Click **Deploy**. Vercel will build and deploy your app. You'll get a live URL like `fitarena-xyz.vercel.app`.

---

## 7. Set Up UptimeRobot (Uptime Monitoring)

UptimeRobot pings your app every 5 minutes and emails you if it goes down. Free plan is sufficient.

> **Claude cannot do this step for you** — it requires clicking through a web UI. It takes about 2 minutes.

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. Click **Add New Monitor**
3. Fill in the form:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** FitArena
   - **URL:** `https://your-vercel-domain.vercel.app/api/health`
     *(replace `your-vercel-domain` with your actual Vercel URL)*
   - **Monitoring Interval:** 5 minutes
4. Scroll down to **Alert Contacts** and add your email
5. Click **Create Monitor**

The `/api/health` endpoint returns `{ "status": "ok" }` when the app and database are both healthy, and `{ "status": "error" }` with HTTP 503 when something is wrong — UptimeRobot will alert you immediately on a 503.

---

## 8. Verify Sentry is Working

After deploying to Vercel (where `NODE_ENV=production`), you can test Sentry like this:

1. Temporarily add `throw new Error("sentry test")` inside any server component or API route — for example at the top of the `GET` handler in `src/app/api/health/route.js`
2. Deploy the change (or just visit the route directly)
3. Open your [Sentry dashboard](https://sentry.io) and check **Issues** — the error should appear within about 30 seconds
4. Remove the test throw and redeploy

You can also test client-side errors by adding `throw new Error("sentry client test")` inside a `useEffect` in any component.

---

## 8. Vercel Environment Variables Checklist

Before going live, confirm **every one of these** is set in your Vercel project under **Settings → Environment Variables**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GROQ_API_KEY`
- [ ] `UNLOCK_TOKEN_SECRET`
- [ ] `RATE_LIMIT_DISABLED`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_ORG`
- [ ] `SENTRY_PROJECT`
- [ ] `SENTRY_AUTH_TOKEN`

Missing any of these will cause silent failures — Supabase won't connect, AI quotes won't load, or Sentry won't capture errors.

---

## Quick Reference

| What | Command / URL |
|---|---|
| Run locally | `npm run dev` |
| Build for production | `npm run build` |
| Health check URL | `/api/health` |
| Sentry dashboard | [sentry.io](https://sentry.io) |
| Vercel dashboard | [vercel.com](https://vercel.com) |
| UptimeRobot dashboard | [uptimerobot.com](https://uptimerobot.com) |
