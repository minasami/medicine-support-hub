# Play Console — Data safety draft (Medicine Support Hub)

Confirm against live Appwrite collections before submitting. This is a starting draft for a catalog / ops app, not clinical care.

## Overview answers (typical)

| Question | Suggested answer | Notes |
|---|---|---|
| Does your app collect or share user-provided data? | **Yes** | Accounts, claims, optional contact fields |
| Is all user data encrypted in transit? | **Yes** | HTTPS to Appwrite / medicinesupport.app |
| Can users request deletion? | **Yes** | Document how (in-app / email privacy contact) |
| Do you follow Google Play Families Policy? | **No** (not primarily for children) | Target 18+ if industry/commerce flows |

## Data types (collect / share / purpose)

Mark **Collected** only if the Android/web app actually gathers it. Adjust if you strip auth from the first Play build.

| Data type | Collected? | Shared? | Purpose | Ephemeral? |
|---|---|---|---|---|
| Name | Yes (account / claim) | No (unless support) | App functionality | No |
| Email | Yes | No | Account | No |
| Phone | Maybe (profile / claim) | No | App functionality | No |
| User IDs (Appwrite) | Yes | No | App functionality | No |
| Approximate location | No (unless you add maps GPS) | — | — | — |
| Precise location | No | — | — | — |
| Photos / videos | Maybe (scan / uploads) | No | App functionality | No |
| Files / docs | Maybe (CSV / donations) | No | App functionality | No |
| App interactions / crash logs | Optional analytics | Check vendor | Analytics / stability | — |
| Device IDs | Usually via SDKs | Check Appwrite / push | App functionality | No |
| Health info | **Avoid claiming** | — | Catalog is reference, not personal health records | — |

**Important:** Do **not** declare “Health and fitness — Health info” unless you store personal medical records. Prefer positioning as educational / reference / business productivity data.

## Security practices

- [x] Data encrypted in transit (TLS)
- [ ] Users can request deletion (add clear path in privacy policy if missing)
- [ ] Independent security review: No (unless you have one)

## Review before submit

1. Re-read https://medicinesupport.app/privacy vs this table
2. List every SDK in the Android app (Appwrite, Capacitor plugins, ML Kit barcode, etc.)
3. If the first Play build is browse-only without login, mark account fields as not collected for that version
