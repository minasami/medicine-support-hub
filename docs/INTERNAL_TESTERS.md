# Internal testers — first install

Play error: **Can't download Medicine Support Hub** on the first Install tap.
Cause: the store page opened before the tester accepted the **opt-in** on the same Google account the Play Store app uses.

## Console (you)

1. Play Console → app → **Test and release → Testing → Internal testing**.
2. Release status **Available** (not Draft).
3. Testers tab: email list saved and **linked to this release**.
4. Countries include Egypt (and tester countries).
5. Copy **How testers join your test** (opt-in URL). Send **that** URL, not only the public store listing.

Opt-in looks like:
- `https://play.google.com/apps/internaltest/…`
- or `https://play.google.com/apps/testing/<package>`

Do not mix this with **Internal app sharing** links unless testers enabled Play Store → Internal app sharing.

## Message to forward (EN)

1. Play Store → profile photo → use the Gmail we invited.
2. Open this link in Chrome (not Play): [PASTE OPT-IN URL].
3. Tap **Become a tester**. Wait 10 minutes.
4. Then Install from the listing.
5. If Install fails: Play Store → App info → Storage → Clear cache → retry.

## Message to forward (AR)

1. متجر بلاي → صورة الحساب → نفس الإيميل المدعو.
2. افتح رابط الدعوة في Chrome.
3. اضغط **Become a tester** وانتظر 10 دقائق.
4. ثم ثبّت التطبيق.
5. إذا ظهر Can't download: معلومات تطبيق بلاي → التخزين → مسح الذاكرة المؤقتة.

## If it still fails

- One Google account only inside Play Store.
- Internal version code higher than any closed/production build.
- Tester on a single test track.
- Workaround: Internal app sharing link, or a signed APK for the first install.
