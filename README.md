# Mason City Farmers Market – Vendor Sign-Up App

A mobile-friendly vendor registration app for off-season markets, built with React + Supabase.

---

## Setup (one-time, ~30 minutes)

### Step 1 — Supabase database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, give it a name (e.g. `mcfm`), choose a region, set a DB password
3. Wait ~1 minute for it to spin up
4. In the left sidebar, click **SQL Editor**
5. Paste the entire contents of `schema.sql` and click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 2 — GitHub repo

1. Create a new repo on GitHub (e.g. `market-signup`)
2. Upload all these files to it (or push from your computer)
3. **Important:** Open `vite.config.js` and change the `base` value to match your repo name:
   ```js
   base: '/market-signup/',   // ← must match your GitHub repo name exactly
   ```

### Step 3 — Add secrets to GitHub

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:
   - Name: `VITE_SUPABASE_URL` / Value: your Supabase Project URL
   - Name: `VITE_SUPABASE_ANON_KEY` / Value: your Supabase anon key

### Step 4 — Enable GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push any change to the `main` branch (or go to **Actions → Deploy to GitHub Pages → Run workflow**)
4. Wait ~1 minute — your app will be live at:
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

---

## Changing the admin password

Open `src/App.jsx` and edit line 8:
```js
const ADMIN_PASSWORD = "mcfm2026";
```

Then push the change to GitHub and it will auto-redeploy.

---

## Local development (optional)

```bash
# 1. Copy the env example and fill in your Supabase values
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

---

## How the app works

| Feature | How it's stored |
|---|---|
| Market dates, capacity, location | `markets` table |
| Vendor sign-ups & waitlist | `signups` table (status = `confirmed` or `waitlist`) |
| Targeted vendor limits | `vendor_limits` table (matched by email) |
| Per-type caps (e.g. max 3 Craft) | `settings` table as JSON |
| Waitlist promotion log | `notifications` table |

When a vendor cancels a confirmed spot, the app automatically promotes the next eligible person from the waitlist (respecting type caps) and logs the promotion.
