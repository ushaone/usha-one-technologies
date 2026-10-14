# ONE AI Master — secure draft workflow candidate

Release status: **not production-ready**. Core, identity-adapter and Chromium checks passed; remote staging, scoped identity/credential configuration and provider verification remain blocked. See [RELEASE.md](RELEASE.md).

## Architecture

Run the same engine code in **two independent Worker deployments**: USHA and Neo. Each has its own ONE AI D1 database, product identity row, token issuer/audience, signing keys, CRM service binding and AI binding. Never bind a CRM's operational database to the engine. Every draft, principal, list, rate limit and audit query is additionally tenant-scoped.

The CRM remains the source of truth. Its server resolves an individual staff identity and creates a short-lived engine token through `integrations/crm-client.mjs`. The engine checks that identity against a provisioned, revocable principal on every request. Role claims from a browser are not accepted. The read-only CRM context connector verifies lead ownership and emits only a normalized status. No parent/customer names, phone numbers, free-text notes, attachments, or student data go to the model.

Workers AI returns a Telugu, English or Hindi **draft**. An owner/manager reviews and submits it; a different manager approves it. Creator, reviewer and last editor cannot approve their own work. Editing approved/rejected text resets it to draft and clears approval. The review UI never interprets message text as HTML. No send operation is enabled.

## Implemented

- HMAC SHA-256 identity tokens, exact issuer/audience/product, maximum five-minute lifetime, key-strength minimum, bounded decoding, database role lookup, account revocation/version checks.
- Dedicated product DB guard, validated identifiers (no silent truncation), prepared SQL, bounded streaming JSON, allowlisted fields, per-actor request/generation limits.
- Immutable draft identity, optimistic version checks, idempotent creation and atomic append-only audit triggers. Failed/stale writes cannot create misleading audit events.
- Generated/manual drafts, paginated list, read, edit, staff submission, manager approval/rejection, audit history.
- Fixed Workers AI model binding and fixed private CRM service binding; no user-supplied fetch URLs, model IDs or prompts; bounded context and model response, timeouts, no automatic model retry.
- Embeddable, responsive review component and a server-only CRM client and a gateway that reuses existing Supabase/Neo individual identities.
- Separate Neo read-only connector PR; USHA context-service contract with tested ownership checks.

## Run checks

Node 24 or later:

```sh
cd one-ai
npm ci
npm run check
npm test
npm audit
npx wrangler d1 migrations apply one-ai-local-tests --local --config test/wrangler.toml
npx wrangler d1 execute one-ai-local-tests --local --config test/wrangler.toml --file test/seed.sql
node scripts/local-runtime.mjs --verify
```

For browser checks, install Playwright and Chromium in the development environment, then run `node scripts/local-runtime.mjs --verify --browser`. The script also supports the Work runtime's existing Playwright installation. Test entrypoints contain explicitly synthetic credentials and model/CRM stubs; **never deploy `test/`**. Local fixture state is ignored by git. These checks do not prove live AI output quality or remote staging availability.

## Integrate

- [DEPLOYMENT.md](DEPLOYMENT.md): isolated staging setup, identity provisioning, rollback and production gates.
- [API.md](API.md): exact routes, token and request contracts.
- [USER_GUIDE.md](USER_GUIDE.md): staff and manager workflow, including Telugu guidance.
- [OUTBOUND.md](OUTBOUND.md): consent, template and provider gates before any sending implementation.
- `integrations/usha-supabase-context.mjs`: concrete private connector against the verified existing Supabase schema; exact lead/business filters and independent staff membership allowlists. See SUPABASE_REVIEW.md for required restricted credentials and existing security findings.
- Neo connector source: `umakanthgilla/neo-school-india-website/integrations/one-ai` on `feature/one-ai-admissions-connector`.

Existing websites, logos, SEO branches, school portals, finance and operational Workers are not modified by this work.

The recovered USHA master handoff confirms existing Supabase Auth, a super_admin profile and CRM tables. The existing project was resumed with owner authorization, and its schema/RLS definitions were verified read-only. The implementation reuses Auth and the confirmed lead-to-business relationship. See `integrations/supabase-schema-inspection.sql` for a read-only schema/RLS inventory.
