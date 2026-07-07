# Contributing

Thanks for improving MUSE Students Voice. Keep every contribution aligned with the platform's core promise: students can raise issues without exposing their identity.

## Ground rules

- Do not expose USNs, user IDs, emails, or author IDs in public UI, exports, logs, or views.
- Public complaint reads must go through sanitized views, not base tables.
- Every new database table needs grants, RLS enabled, and policies in the same migration.
- Keep write actions authenticated and scoped to the current user unless they are explicitly admin-only.
- Do not commit private secrets. Use `.env.example` for variable names only.

## Local checks

```bash
bun install
bun run lint
bun run build
```

## Pull requests

- Explain the user-facing change.
- Mention any access-control or privacy impact.
- Include screenshots for UI changes.