# Medicine Support Hub native distribution

The website and installed PWA remain the canonical application. Native packages are deliberately thin, signed shells around `https://medicinesupport.app` so authentication, authorization, clinical safeguards, and releases do not diverge across platforms.

## Android / Google Play

Use the Trusted Web Activity workflow in [`android/README.md`](android/README.md). The provisional package identifier is `app.medicinesupport.hub`. Do not publish the Digital Asset Links file until Google Play provides the production app-signing SHA-256 fingerprint.

## Windows / Xojo

Use the Xojo Desktop wrapper specification in [`windows-xojo/README.md`](windows-xojo/README.md). The wrapper must never store Supabase, Appwrite, Resend, Google, Gemini, or xAI server credentials.

## AI-assisted review

- Google AI Studio: use [`android/AI_STUDIO_REVIEW_BRIEF.md`](android/AI_STUDIO_REVIEW_BRIEF.md).
- Grok Build: use [`GROK_BUILD_REVIEW.md`](GROK_BUILD_REVIEW.md).

AI-generated changes must be reviewed as ordinary pull-request changes and pass the repository validation gates before release.
