# MUSE Students Voice

Anonymous student complaints board for **Mysore University School of Engineering (MUSE)**.
Students sign in with their USN, post grievances anonymously, and the community
votes True/False. Verified complaints (past a quorum threshold) are exported as a
formal PDF letter addressed to the Director and VC. False complaints are removed.

Live: https://muse-studentsvoice.lovable.app

---

## Features

- **USN-gated signup** — one account per USN, validated against a seeded registry
  (AIML, AIDS, CS&D, BMRE, CIVIL — 2022 to 2025 batches, ~1,159 USNs).
- **Anonymous posting** — USN is stored only to prevent duplicates, never shown
  on posts, votes, or the letter to leadership.
- **True/False voting** with a 25/30-vote quorum and percentage breakdown.
- **Comments** on every post with per-post pseudo-handles.
- **Public read-only feed** — anyone can browse, see votes and comments.
- **Location + Issue type** taxonomy (labs, blocks, admin; infrastructure,
  safety, faculty conduct, etc.).
- **Admin panel** — moderation queue for flagged posts, threshold-ready
  complaints, one-click PDF letter generation.
- **Google OAuth + email/password** with password reset flow.
- **Live visitor badge**, dark mode ("Midnight Letterhead" palette),
  SEO metadata, sitemap.xml, robots.txt.

## Tech Stack

- **Framework**: TanStack Start v1 (React 19, Vite 7, SSR on Cloudflare Workers)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Lovable Cloud (Supabase — Postgres, Auth, RLS)
- **PDF**: jsPDF (client-side letter generation)
- **Routing**: File-based routes in `src/routes/`

## Project Structure

```
src/
  routes/           # File-based routes (TanStack Router)
    __root.tsx      # Root layout + sitewide head metadata
    index.tsx       # Public landing + read-only feed
    auth.tsx        # Signup / signin / forgot password
    feed.tsx        # Authenticated feed
    post.$id.tsx    # Single complaint view
    admin.tsx       # Admin moderation + letter generation
    my-complaints.tsx
    about.tsx  privacy.tsx  terms.tsx  verified.tsx
    reset-password.tsx
    sitemap[.]xml.ts
  components/       # SiteShell, PostCard, SplashScreen, VisitorBadge, ui/*
  lib/              # auth, posts, escalations, letterPdf, theme
  integrations/     # supabase clients (auto-generated)
public/             # robots.txt, static assets
```

## Local Development

```bash
bun install
bun run dev            # http://localhost:8080
bun run build          # production build
bun run lint
```

Requires Node 20+. `bun` recommended.

## Environment

Cloud credentials are injected by Lovable Cloud in production. For local dev
you need a `.env` with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

These are **publishable** (anon) keys — safe for a private repo.
Never commit service-role keys.

## Database

Managed on Lovable Cloud (Supabase). Key tables:

- `allowed_usns` — seeded USN registry with department mapping
- `profiles` — one row per user, linked to a USN
- `posts` — complaints (location + issue_type)
- `votes` — one true/false vote per user per post
- `comments` — anonymous comments with per-post pseudo-handles
- `escalations` — verified complaints exported to PDF
- `user_roles` — admin role assignments (checked via `has_role()` RPC)
- `site_visits` — anonymous visitor heartbeats

RLS is enabled on every public table.

## Admin

Admin access is granted via a row in `user_roles` with role `admin`,
scoped to a specific USN. Current admin: `24SEAI003`.
To promote another user, insert a `user_roles` row via SQL.

## Contact

studentsvoice.muse@gmail.com

## License

All rights reserved © MUSE Students Voice.
