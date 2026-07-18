# Google AI Studio Android review brief

Review a Trusted Web Activity wrapper for `https://medicinesupport.app`, package `app.medicinesupport.hub`.

Constraints:

- The production PWA is the source of truth; do not recreate authentication, database access, clinical logic, or company authorization natively.
- Do not place Supabase service-role keys, Appwrite keys, Gemini keys, Resend keys, or other server credentials in Android resources or source code.
- Preserve all deep links and return-to-origin sign-in behavior.
- Use Play App Signing and Digital Asset Links.
- Produce review comments and a patch, not an unrelated replacement application.
- Check accessibility, RTL Arabic, safe areas, file uploads, notifications, location permission, back navigation, offline behavior, and Play Data Safety implications.

Deliverables:

1. Findings ordered by release risk.
2. Minimal patch for the generated Bubblewrap project.
3. Internal-testing checklist.
4. No changes to production without human review.
