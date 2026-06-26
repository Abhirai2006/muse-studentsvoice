
# Anonymous College Complaints Board

A platform where students sign up with a pre-approved USN, post complaints anonymously, vote True/False, and discuss via comments. Posts confirmed True get emailed to the Director + VC and kept forever; posts confirmed False are auto-deleted.

## Core rules

- **One account per USN, and one account per person.**
- **User chooses their own password** at signup (min 8 chars, strength meter, HIBP leaked-password check enabled).
- **Allowed USNs (seed list, more later):**
  - 24SEAI001 – 24SEAI087
  - 25SEAI400 – 25SEAI405
  - 24SEAD001 – 24SEAD060
  - 24SECD001 – 24SECD120
- **One vote per USN per post** (True/False, switchable, not both).
- **Comments**: signed-in students only. Shown as stable per-post pseudo-handle ("Student #A7F2"). Author edits/deletes own comments; post author can delete comments on their post.
- **Author can edit/delete their own post anytime** (edits reset vote tallies).
- **Public view** — anyone (no login) can read posts, comments, and vote counts.

## Anti-duplicate-account measures (no college email available)

Since the college doesn't issue student emails, we layer cheap personal-cost barriers so one student can't easily claim multiple USNs:

1. **Required, verified personal email — globally unique.** Sign-up requires a real email and confirms via magic link. Same email cannot register twice. A determined attacker can create multiple Gmails, so this is one layer, not the only one.
2. **Phone OTP verification — globally unique phone number.** Each account must verify one mobile number; same number can't claim a second USN. Phone numbers are far harder to mass-create than emails. (Via Lovable Cloud SMS auth or GatewayAPI/Twilio.)
3. **Device + IP signal (soft).** On signup we store a hashed device fingerprint + IP. A second USN signup from the same fingerprint is flagged for admin review — not auto-blocked, since students share Wi-Fi.
4. **Admin review queue** at `/admin` for flagged duplicates; admin approves or rejects.
5. **Rate limit signups per IP** (e.g. 3/day) to slow scripted abuse.

Phone OTP is the strongest single signal here. Confirm you want it on (default: yes) — it costs a few paise per SMS at India rates.

## Voting outcome (defaults, tunable)

When a post has **≥ 20 votes** AND has been open **≥ 48 hrs**:
- **True ≥ 70%** → `verified_true`, email Director + VC, archived forever, comments locked.
- **False ≥ 70%** → soft-delete, hidden from public, kept for audit.
- Otherwise → stays open.

## Pages

1. `/` — Public feed (read-only).
2. `/auth` — Sign up (USN + password + email + phone OTP) / sign in / password reset.
3. `/feed` — Authenticated: post, vote, comment, edit/delete own.
4. `/post/$id` — Permalink with comment thread.
5. `/verified` — Permanent archive.
6. `/admin` — Recipients, thresholds, duplicate-signup review.

## Database

```text
allowed_usns(usn pk, claimed_by_user_id nullable, claimed_at)
profiles(user_id pk → auth.users, usn unique, phone_hash unique, signup_fingerprint, signup_ip_hash, created_at)
user_roles(user_id, role)
posts(id, author_id, body, status, created_at, resolved_at)
votes(id, post_id, voter_id, value, unique(post_id, voter_id))
comments(id, post_id, author_id, body, created_at, updated_at, deleted_at)
signup_flags(id, user_id, reason, status[pending|approved|rejected], created_at)
escalations(id, post_id, sent_to[], sent_at, message_id)
recipients(id, role[director|vc|other], email, active)
config(key pk, value)
```

RLS: profiles/votes/comments scoped to `auth.uid()`; posts/comments public via views projecting safe columns + pseudo-handle only; `claim_usn(usn, phone_hash, fingerprint, ip_hash)` SECURITY DEFINER atomically claims USN, enforces phone uniqueness, and flags duplicate-device signups.

## Build order

1. Enable Lovable Cloud (HIBP password check + email confirmation on).
2. Migrations: tables, RLS, `has_role`, `claim_usn`, `comment_pseudo_handle`, public views, `resolve_posts`, seed `allowed_usns` + default config.
3. Design system in `src/styles.css` (clean, civic tone — not purple).
4. Auth pages: USN + password + email confirm + phone OTP.
5. Public feed + permalink (comments) + verified archive.
6. Authenticated feed: composer, votes, comments, author moderation.
7. Admin page: recipients, thresholds, duplicate review queue.
8. Email infra + `complaint-verified` template + pg_cron for `resolve_posts`.
9. Sitemap/robots, route metadata.

## Open questions (defaults if you don't reply)

1. **Phone OTP** — enable? Default: yes (strongest dedupe given no college email).
2. **Thresholds** — 20 votes, 48 hrs, 70%. OK?
3. **Director & VC emails** — seed now or fill in `/admin` later?
4. **Comment voting** — default: no upvotes on comments.
