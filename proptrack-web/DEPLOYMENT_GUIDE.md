# PropTrack Web — Deployment Guide

Three moves to break free from the App Store. Follow each in order.

---

## Move 1: Deploy the Web App to Vercel

### Step 1 — Create the GitHub repo

```bash
# From your local machine
cd ~/Projects  # or wherever you keep code

# Clone the proptrack-web project (or download the tar.gz and extract)
mkdir proptrack-web
cd proptrack-web

# Initialize git
git init
git add .
git commit -m "PropTrack web app — initial commit"

# Create the repo on GitHub
# Go to github.com/new → name it "proptrack-web" → create
# Then:
git remote add origin https://github.com/jarrettlove48-web/proptrack-web.git
git branch -M main
git push -u origin main
```

### Step 2 — Get your Supabase anon key

You already know your Supabase project ID: `tfshawyalkvxmryjqbzh`

1. Go to https://supabase.com/dashboard/project/tfshawyalkvxmryjqbzh/settings/api
2. Copy the **Project URL** → `https://tfshawyalkvxmryjqbzh.supabase.co`
3. Copy the **anon / public** key (starts with `eyJ...`)

### Step 3 — Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to `proptrack-web`
3. In **Environment Variables**, add these two:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tfshawyalkvxmryjqbzh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your anon key from Step 2) |

4. Click **Deploy**
5. Wait for the build to finish (should take ~60 seconds)

### Step 4 — Set up the custom domain

Once deployed, you want this at `app.proptrack.app`:

1. In Vercel → your project → **Settings → Domains**
2. Add `app.proptrack.app`
3. Vercel will give you a CNAME record to add
4. In Cloudflare (where proptrack.app lives):
   - Go to DNS settings
   - Add a CNAME record:
     - **Name:** `app`
     - **Target:** `cname.vercel-dns.com` (Vercel will tell you the exact value)
     - **Proxy status:** DNS only (grey cloud — turn OFF proxy for Vercel)
5. Back in Vercel, click **Verify** — it should go green within a few minutes

### Step 5 — Update Supabase auth redirect URLs

1. Go to https://supabase.com/dashboard/project/tfshawyalkvxmryjqbzh/auth/url-configuration
2. Under **Redirect URLs**, add:
   - `https://app.proptrack.app/auth/callback`
   - `https://app.proptrack.app/**`
   - `http://localhost:3000/auth/callback` (for local dev)
3. Save

**✅ Move 1 complete.** Your web app is now live. Landlords can sign up and use the dashboard at `app.proptrack.app`. Same Supabase database as the mobile app — anything created on either platform shows up on both.

---

## Move 2: Tenant Portal with Invite Codes

The tenant portal is already built into the web app. Here's how the full flow works end-to-end.

### How it works

1. **Landlord** goes to `/dashboard` → clicks into a property → clicks "Generate invite code" on a unit
2. System creates a 6-character code (e.g. `X7KM2P`) stored on the unit row
3. **Landlord** copies the code and sends it to the tenant (email link is built in)
4. **Tenant** visits `app.proptrack.app/invite` → enters email + code
5. Supabase RPC `verify_invite_code` validates it → tenant creates account
6. Tenant is linked to the unit (`tenant_user_id` set on the `units` row)
7. **Tenant** lands at `/tenant` — can see their unit, submit requests, message landlord
8. **Everything syncs in realtime** — landlord sees new requests and messages instantly on web AND mobile app

### What's already wired up

Your Supabase schema already has all the pieces:

- `units.invite_code` — stores the generated code
- `units.is_invited` — tracks whether an invite was sent
- `units.tenant_user_id` — links to the tenant's auth user
- `units.tenant_portal_active` — flags active tenant connections
- `verify_invite_code` RPC — server-side code validation (bypasses RLS)
- Tenant RLS policies — tenants can only see their own unit, property, requests, and messages
- Realtime enabled on `messages` and `maintenance_requests` tables

### Test it yourself

1. Sign in as a landlord at `app.proptrack.app/auth`
2. Go to a property → click "Generate invite code" on a unit
3. Copy the code
4. Open an incognito window → go to `app.proptrack.app/invite`
5. Enter a different email + the invite code
6. Create the tenant account
7. Submit a test maintenance request from the tenant portal
8. Switch back to the landlord tab — you should see the request appear

### The viral growth loop

Every landlord you get brings their tenants with them:

```
1 landlord signs up
  → adds 3 units
  → invites 3 tenants
  → 3 tenants use the web portal (no app install needed)
  → tenants tell friends who are also tenants/landlords
  → repeat
```

The key insight: **tenants don't need to download anything.** They visit a URL, enter a code, and they're in. Zero friction.

**✅ Move 2 complete.** Tenant invite flow works end-to-end on web. Compatible with the mobile app's existing invite system — a code generated on mobile works on web and vice versa.

---

## Move 3: PWA (Progressive Web App)

This lets users "install" PropTrack from their browser to their home screen — it looks and behaves like a native app without going through any app store.

### What's already done

The web app already includes:

- `public/manifest.json` — PWA manifest with app name, colors, icons, standalone display mode
- `<link rel="manifest">` in the root layout
- `theme-color` meta tag set to PropTrack teal (#0C8276)

### Step 1 — Generate PWA icons

You need icon files at 192x192 and 512x512. Use your existing PropTrack app icon:

1. Take your app icon from `rork-proptrack-rental-app/assets/images/icon.png`
2. Go to https://realfavicongenerator.net/ (or use any icon resizer)
3. Upload your icon and generate these sizes:
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
   - `apple-touch-icon.png` (180x180)
4. Drop them into `public/icons/` in the proptrack-web project
5. Commit and push — Vercel will auto-deploy

### Step 2 — Add a service worker (optional, enhances offline)

Create `public/sw.js`:

```javascript
const CACHE_NAME = "proptrack-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
```

Then register it. Add this to `app/layout.tsx` inside the `<body>` tag, after `{children}`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    `,
  }}
/>
```

### Step 3 — Test the install prompt

1. Open `app.proptrack.app` in Chrome (desktop or mobile)
2. **Desktop:** Look for the install icon in the URL bar (⊕ or ↓ icon), or click the three-dot menu → "Install PropTrack"
3. **Mobile Chrome:** You'll see a "Add to Home Screen" banner, or tap the three-dot menu → "Add to Home Screen"
4. **iOS Safari:** Tap the share button → "Add to Home Screen"

Once installed, PropTrack opens in its own window — no browser chrome, no URL bar. It looks like a native app.

### What users see

| Platform | How they install | What it looks like |
|----------|------------------|--------------------|
| Android Chrome | "Add to Home Screen" prompt auto-appears | Full-screen app, icon on home screen |
| iOS Safari | Share → Add to Home Screen | Full-screen app, icon on home screen |
| Desktop Chrome | Install icon in URL bar | Standalone window, taskbar icon |
| Desktop Edge | Install prompt | Standalone window, taskbar icon |

**✅ Move 3 complete.** Users can install PropTrack from the web without any app store approval.

---

## Summary: Your 4 Distribution Channels

| Channel | URL | Who | Status |
|---------|-----|-----|--------|
| **Web app** | `app.proptrack.app` | Landlords + tenants | ✅ Ready after Move 1 |
| **Tenant portal** | `app.proptrack.app/invite` | Tenants (viral) | ✅ Ready after Move 2 |
| **PWA install** | Install from browser | Both | ✅ Ready after Move 3 |
| **App Store** | App Store / Google Play | Both | Whenever Apple approves |

The App Store is now channel #4, not channel #1. If they approve you — great, bonus. If they don't — you're already live, already growing, already have tenants using the platform.

---

## Local Development

```bash
cd proptrack-web
npm install

# Create .env.local with your Supabase credentials
cp .env.local.example .env.local
# Edit .env.local and add your real anon key

npm run dev
# → http://localhost:3000
```

---

## What's Next

Once you're live and getting users, the highest-impact moves are:

1. **Add the web app link to proptrack.app** — your landing page should link to `app.proptrack.app` with "Open web app" and "I'm a tenant" buttons
2. **Email invite links** — when a landlord generates an invite code, send an automated email to the tenant with a direct link to `app.proptrack.app/invite`
3. **Google sign-in** — add OAuth for even lower friction (Supabase supports this natively)
4. **SEO pages** — add blog/content to the web app to rank for "landlord maintenance tracker", "tenant maintenance request portal", etc.
