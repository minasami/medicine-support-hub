# Grok Build review handoff

Run Grok Build from a clean checkout and ask it to review—not autonomously deploy—the native wrapper work:

```text
Review native/android and native/windows-xojo for Medicine Support Hub. Verify that the Android Trusted Web Activity and Xojo WebView shell preserve the production PWA as the source of truth, contain no server secrets, support deep links and return-to-origin authentication, and do not weaken clinical privacy. Report findings by severity and propose minimal patches. Do not deploy, publish, rotate credentials, or modify production infrastructure.
```

Any suggested patch must pass type checking, Appwrite/Vercel preview builds, manual Android internal testing, and Xojo clean-machine testing before acceptance.
