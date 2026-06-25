---
name: Auth session design
description: How staff authentication is implemented in ChronicMed
---

Staff auth uses a simple stateless-ish approach with no JWT library:

- **Password hashing:** `crypto.scryptSync(password, salt, 64)` — salt stored as prefix `salt:hash` in `staff_users.password_hash`
- **Sessions:** In-memory `Map<token, SessionData>` in `artifacts/api-server/src/lib/auth.ts`
- **Cookie:** `cm_session` httpOnly, sameSite: lax, 8h maxAge, secure in production
- **Seed:** `seed-admin.ts` seeds 10 default users on first startup (checks if admin exists first)

**Why:** No external auth library needed; crypto is built into Node. Sessions are in-memory so they reset on server restart (fine for demo/dev; would need Redis for production scale).

**How to apply:** The `COOKIE_NAME` constant and session helpers are exported from `lib/auth.ts`. Use `requireAdmin` middleware in `routes/admin.ts` as the pattern for role-protected routes. Use `requireAuth` for any route that only authenticated staff should access.
