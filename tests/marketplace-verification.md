# Marketplace validation — 16 November 2026

- Supabase SQL transaction tests passed; all fixtures rolled back.
- Checked: seven-day server-side trial; restricted column writes; unauthorized VIP, verification, XP and admin RPC rejection; pending listings hidden from public; owner-only editing; message participant isolation and injection rejection; admin sale confirmation; duplicate XP prevention; XP reversal; expired trial write rejection; VIP restores seller capability without granting admin.
- Public catalogue API and seller landing checked in browser against live Supabase.
- Responsive seller landing checked at 390px using a local iframe.
- Dashboard, level 4 at 300 XP, listing editor, range 0–200 and draft save checked with an explicitly local mocked seller fixture. This is not an authenticated end-to-end test of uploads or Google login.
- Existing authenticated Google user was not impersonated. Real photo upload plus full authenticated buyer/seller UI exchange still needs a logged-in user smoke test; database ownership and message rules were tested directly.
- Security advisor: no new marketplace warnings. Existing public guarded SECURITY DEFINER functions and leaked-password protection warning remain outside this change.
- Payment collection is absent. Paid subscription provisioning must use a trusted billing integration later. Trial expiry hides listings and blocks seller writes; VIP is independent of admin membership.
- Sales are manually confirmed by an administrator with evidence; they are not represented as payment-provider-confirmed orders.
