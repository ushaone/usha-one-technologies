# USHA ONE Voice Reminders MVP

A separate, additive USHA ONE module: Excel/CSV import, manual dues, consent controls, Telugu templates, paid/pause actions, call history and a Cloudflare scheduled Worker backed by Supabase Postgres.

## Current delivery

- `dist/`: responsive portal. Starts in explicitly labeled browser-local demo mode; no calls are made. Sample customers and call results are fictional. Connect backend switches to server records and never uploads demo data.
- `backend/worker.mjs`: deployable authenticated HTTP API, Twilio status webhook, cron dispatcher and reconciliation.
- `backend/schema.sql`: clean-install schema, already applied to USHA ONE Supabase project `tjpvhklsegkvkqvhbrev` on 2026-10-18. Do not reapply to that project. Migrations: `voice_reminders_mvp`, `voice_reminders_claim_variable_fix`.
- `tests/worker.test.mjs`: 14 passing Node tests. Database transaction tests passed and rolled back synthetic data.
- Production portal `tech.ushaone.workers.dev` has not been modified. The new module is on a feature branch for integration.
- Real voice calls and the Cloudflare backend are NOT deployed/activated. No Twilio credentials or live calls were used.

## Local verification

Requires Node 22+; no application npm dependencies needed.

```sh
bash scripts/prepare-assets.sh
npm test
```

Serve `dist` with any static development server. Opening HTML directly with `file://` will not load ES modules. The preview includes SheetJS CE 0.20.3; the GitHub checkout restores the same checksum-verified asset with scripts/prepare-assets.sh. SheetJS CE 0.20.3 is vendored for .xlsx/.csv parsing; see THIRD_PARTY_LICENSES.txt. Fonts may use the Google Fonts service; system font fallback works offline.

## Activate the backend

1. Use the existing USHA ONE Supabase project. The module tables are `vr_customers`, `vr_dues`, `vr_attempts`, `vr_settings`. The schedule is paused. No synthetic records remain. For a different, fresh Supabase database, apply `backend/schema.sql` once.
2. Deploy the separate Worker from `backend/` using Wrangler. It serves the same portal assets. Do not rename it `tech` or overwrite the existing website Worker.
3. Set Worker variables: `SUPABASE_URL` = the project HTTPS URL; `PUBLIC_BASE_URL` = deployed reminder Worker's HTTPS origin (no path); `PORTAL_ORIGIN` = exact separate frontend origin if applicable; `TWILIO_FROM` = your approved Twilio caller number; `TWILIO_VOICE` = a supported Telugu voice, for example `Google.te-IN-Chirp3-HD-Aoede`. Keep `CALL_MODE=disabled` initially.
4. Set Worker secrets using `wrangler secret put NAME`: `ADMIN_TOKEN` (generate at least 32 random characters), `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`. Never put service keys in frontend files, Git, URLs or chat. This MVP is a single-business administrator console; separate staff roles and multi-tenancy are not implemented.
5. Open the portal, choose Connect backend, and enter the Worker origin and ADMIN_TOKEN. Token stays in browser memory, not local storage. Verify empty real records and provider configuration.
6. First validate Twilio delivery and Telugu pronunciation with an authorized test number. Use the Twilio console for the test, or a controlled test due in a separate test database. Do not enable a populated production schedule as a test. India-bound Twilio calls originate from international numbers; this does not provide a local +91 caller identity.
7. After testing, change `CALL_MODE=live` in Worker settings and redeploy/update the environment. Keep the database schedule paused until customer consent, message and dues are reviewed. Enable schedule in Voice & schedule. Initial schedule is paused even when the environment permits calling.
8. On the existing portal, add a navigation link to the new reminder Worker. If hosting the UI under an existing path, copy `dist/` to that path and configure exact CORS origin. Keep the callback on the public Worker, not on an owner-private preview domain.

Wrangler configuration includes cron triggers from 09:00–17:55 IST in five-minute batches. Each batch claims at most 10 dues. Database time checks enforce the 09:00–18:00 IST window. A due receives at most one attempt per day and three attempts total. Due and overdue records are eligible; future, paid, paused and non-consenting records are not.

## Upload format

Headers: `name,phone,reference,amount,due_date,consent`.

- Phone: Indian mobile, +91 or ten digits. Keep cells as text where possible.
- Amount: positive INR, max two decimal places.
- Due date: ISO YYYY-MM-DD or an Excel date cell.
- Consent: yes/true/1 records consent. Everything else means no consent.
- Reference: globally unique invoice ID within this single-business deployment.
- Limit: 500 rows and 2 MB per upload; first worksheet only. All validation errors must be fixed before importing.
- Duplicate references are skipped, not overwritten. Existing customers retain their existing name and consent on repeat imports. Update consent with Record/Revoke consent.

## Reliability and security

Bearer authentication protects all admin endpoints, including health. Secrets stay server-side. All tables have RLS, no client grants or client policies, and service-role-only access. RPC functions are SECURITY INVOKER with fixed search_path and revoked public execution.

Claims lock the singleton settings row and eligible invoices; uniqueness on `(due_id, attempt_day)` prevents duplicate daily attempts. Each attempt transitions through reserved -> dispatching once. The dispatcher rechecks consent, invoice state and the global pause before making a provider request. Calls already dispatched can finish after a pause or paid marking.

Callbacks validate Twilio's HMAC-SHA1 signature against the configured canonical public URL, verify AccountSid and bind CallSid to the attempt. Terminal states cannot regress to ringing because a delayed callback arrives. Active calls with known SIDs are reconciled with Twilio after 15 minutes.

A network timeout/5xx during call creation is ambiguous and becomes uncertain. No automatic retry is permitted for uncertain or stuck reserved/dispatching attempts. Inspect Twilio logs before any operator intervention; never reset an ambiguous attempt to pending blindly. If no callback arrives and no SID was persisted, operator reconciliation is required. A completed call stops retries for that invoice, but never marks it paid. Busy/no-answer/failed/canceled attempts are eligible on following days up to the attempt cap.

## Validation and limitations

14 Node tests cover input validation, IST boundaries, XML escaping, HMAC signatures, authentication, CORS, disabled dispatch, duplicate uploads, uncertain dispatch handling, paid/paused recheck and Twilio request construction.

Live Postgres transaction tests verified import idempotency, paused dispatch, terminal ordering, mismatched SID rejection, client privilege denial, queue eligibility, repeated claims and repeated begin prevention. Test rows were rolled back. A claim-variable ambiguity found by these tests was fixed and retested.

Browser visual/interaction QA was not available in the build environment; no browser rendering or device tests are claimed. No real PSTN/Twilio end-to-end call test was performed. Provider availability, pronunciation, billing, account permissions and actual webhook delivery still require a configured test.

UI outstanding balances are for the current 500-row page. Call statistics and history use the latest 100 attempts. Browser speech preview depends on an installed Telugu voice and is not the Twilio voice. The deployed preview is not the production calling service.

Supabase advisors report INFO `rls_enabled_no_policy` for the four deliberately backend-only tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Existing unrelated project findings (product_signals view, pre-existing functions, password protection) were left unchanged and are not introduced by this module.

## API

GET /api/health — authenticated configuration readiness.
GET /api/dashboard?offset=0 — 500 invoices, 100 recent attempts and settings.
POST /api/import — `{rows:[...]}`, atomic insert, duplicate references skipped.
PATCH /api/dues/:id — `{state:"paid"|"pending"|"paused"}`.
PATCH /api/customers/:id/consent — `{consent:boolean}`.
PATCH /api/settings — `{paused, business_name, template}`.
POST /webhooks/twilio?id=:attempt_id — signed Twilio callback only.

## Official references

- https://www.twilio.com/docs/voice/twiml/say/text-speech
- https://www.twilio.com/docs/usage/security
- https://www.twilio.com/en-us/guidelines/in/voice
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://supabase.com/docs/guides/api/securing-your-api
