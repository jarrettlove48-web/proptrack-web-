# PropTrack Web

The web companion to the PropTrack mobile app. Same Supabase backend, same auth, same realtime — just built for the browser.

**Landlords** get a full dashboard at `/dashboard`
**Tenants** get a portal at `/tenant` (enter via `/invite` with their code)

## Stack

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **Supabase** (shared with mobile app — project `tfshawyalkvxmryjqbzh`)
- **TypeScript**
- **Lucide React** icons
- **PWA** manifest for home screen install

## Setup

```bash
# 1. Clone
git clone https://github.com/jarrettlove48-web/proptrack-web.git
cd proptrack-web

# 2. Install
npm install

# 3. Environment
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key

# 4. Dev
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import in Vercel → connect to `proptrack-web` repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → set custom domain to `app.proptrack.app`

## Architecture

```
proptrack-web/
├── app/
│   ├── page.tsx              # Landing page (public)
│   ├── auth/page.tsx         # Landlord login/signup
│   ├── invite/page.tsx       # Tenant invite code entry
│   ├── dashboard/            # Landlord dashboard (protected)
│   │   ├── layout.tsx        # Sidebar nav
│   │   ├── page.tsx          # Properties overview
│   │   ├── requests/         # All requests
│   │   ├── expenses/         # Expense tracking
│   │   ├── messages/         # Realtime messaging
│   │   ├── account/          # Profile settings
│   │   └── property/[id]/    # Property detail + unit management
│   └── tenant/page.tsx       # Tenant portal (protected)
├── lib/
│   ├── supabase-browser.ts   # Client-side Supabase
│   ├── supabase-server.ts    # Server-side Supabase
│   └── types.ts              # Shared TypeScript types
├── middleware.ts              # Auth protection + session refresh
└── public/
    └── manifest.json          # PWA manifest
```

## How it connects to the mobile app

Both apps hit the **exact same Supabase project**. A landlord can:
- Create a property on their phone → see it on the web dashboard
- Generate an invite code on the web → tenant redeems it on their phone (or web)
- Get a realtime message from a tenant on either platform

The web app uses `@supabase/ssr` for cookie-based auth (instead of AsyncStorage on mobile). Same RLS policies, same database rows, same realtime channels.

## Brand

- Primary: `#0C8276` (teal)
- Accent: `#D4883A` (gold)
- Background: `#F8F6F3` (warm white)
- Text: `#1C1917` (charcoal)
- Fonts: DM Sans + DM Serif Display
