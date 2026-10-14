# ONE AI Master production readiness report

Date: 2026-10-14. Decision: **NO-GO for production**. No production deployment, merge, database change or outbound message was performed.

## Source reviewed

- USHA engine PR #3, branch `feature/one-ai-master-foundation`, starting commit `1e2d8b27ef0c0185c58c791bdc4ffc9708948b2c`.
- Neo `main` at `d503b535e59471938e80c6fb6a92b59636a1eda0`; new branch `feature/one-ai-admissions-connector`.
- Existing website, assets, SEO and school/finance/operational source files remain unchanged. CI configuration and ONE AI-specific files are the only additions/edits. No existing production schema or portal was rewritten.

## Deliverable status

| Deliverable | Status and boundary |
|---|---|
| Master draft engine | Implemented and locally tested; no remote staging evidence |
| Authentication and permissions | Signed tokens, live principal/role checks and tested Supabase/Neo identity gateway implemented; live bindings and membership provisioning pending |
| Database isolation | Separate deployment/database/keys per product design with enforced product guard, tenant SQL scoping; actual cloud resources not provisioned |
| Transactions and audit | Atomic SQLite audit triggers, append-only events, optimistic versions and idempotent creation tested |
| Telugu, English, Hindi generation | Workers AI adapter and safety/minimization checks implemented; automated tests use synthetic model output; live inference and native-language quality review pending |
| Staff/manager approval | API workflow tested, including self-approval denial and approval invalidation; responsive review panel and Chromium workflow test passed in GitHub CI |
| USHA CRM | Server client and context adapter contract tested; recovered handoff confirms Supabase Auth/CRM; actual lead columns, ownership joins and RLS definitions still needed |
| Neo Admissions CRM | Separate read-only connector implemented/tested against repository table contract; archived v2 schema inspected; actual deployed version, gateway/CRM mounting and membership configuration pending |
| Outbound messaging | Disabled; no provider/consent/template setup was verified |
| Staging verification | Local workerd/D1 checks passed with synthetic CRM/AI; remote staging not deployed/verified |
| Documentation | API, staging/provisioning, security operations, rollback, outbound gates and English/Telugu user guide supplied |
| GitHub | Engine PR #3 and Neo PR #27 published as drafts; CI passed, including engine Chromium workflow |

## Executed evidence

| Check | Result |
|---|---|
| Initial existing foundation tests | 3 passed before modification |
| `npm run check` | Passed JavaScript syntax checks |
| Engine `npm test` | **20 tests passed**, 0 failed |
| Neo `node --test integrations/one-ai/worker.test.mjs` | **1 test passed**, 0 failed; multiple ownership/PII cases |
| SQLite integration/security cases | Passed tenant/product isolation, revoked accounts, role denial, stale update race, failed audit rollback, append-only events, idempotency conflict, payload limits, provider failures and model-input minimization |
| `npm audit` | 0 known vulnerabilities reported, including installed development dependencies |
| Wrangler local D1 migrations 0001 + 0002 and synthetic seeding | Passed |
| Direct Miniflare/workerd smoke | Passed readiness, Telugu stub draft, staff submission, distinct manager approval, stale-write denial, audit sequence, blocked send |
| Worker `wrangler deploy --dry-run` | Bundle completed; this uploads/deploys nothing and had no live bindings |
| Chromium review-panel smoke | **Passed on GitHub CI**: mobile 390px layout, draft generation/edit/review, staff approval rejection, manager approval, inert HTML text and no send control |
| `wrangler whoami` | Not authenticated; remote staging/production unavailable |

Wrangler dev initially failed because the execution environment could not enumerate network interfaces. The documented direct Miniflare runtime avoided that CLI issue. The original compatibility date 2026-10-14 exceeded the installed workerd maximum; both configurations were corrected to 2026-10-13. The direct runtime test then passed. Chromium was unavailable locally and the download failed; GitHub CI installed it successfully and ran the real browser-to-local-Worker test. These are synthetic runtime/browser checks, not a remote staging deployment.

## Blocks requiring external input/access

1. **Cloudflare authorization plus verified staging account/database identifiers**, separately for each organization. Configure secrets in the deployment account, not chat. No Cloudflare account access was available in this session.
2. **Existing USHA Supabase schema/RLS export and staff membership configuration.** The recovered master handoff confirms existing Auth and CRM table names; the read-only SQL inventory supplied with this branch will resolve column-level lead ownership. The new gateway reuses Supabase Auth.
3. **Current Neo deployment version and individual employee membership mapping.** The archived v2 package was inspected and lacks Growth CRM tables and employee school_id in its identity response. The current repository has the newer contract; verify the deployed endpoint before enabling the gateway. Shared admin/branch credentials remain unsupported.
4. **Live model enablement and language sign-off**, using synthetic leads in remote staging; provider account/budget/data handling must be verified.
5. **Remote end-to-end tests of the mounted CRM component.** Synthetic Chromium testing is complete; actual existing portals and live provider bindings are not verified.
6. If sending is required for launch: verified recipient consent records, approved templates, tenant-specific messaging-provider credentials, signed webhooks and a tested idempotent outbox. Sending must stay disabled until then.

After these gates pass, produce a concrete deployment/rollback plan and request the owner's production authorization. Do not present this branch as a launched or fully integrated service.

## Remaining engineering and operational limits

- Review UI is a reusable component, not mounted in the existing production CRMs. The tested gateway reuses existing verified identities; mounting, bindings and explicit staff membership configuration are still pending.
- Actual AI output accuracy, multilingual quality, availability and quota behavior have not been tested.
- Tokens are reusable during their short validity window; revocation is via principal membership/version. HMAC issuers must remain trusted server components.
- Rate limits bound per-actor requests; organization-wide budgets and edge abuse controls require deployment configuration.
- An AI timeout can leave inference running; no automatic retries are performed. Concurrent duplicate requests can consume extra inference before the unique DB key deduplicates persistence.
- Audit is append-only to normal SQL updates/deletes, not cryptographically tamper-evident against a privileged DB administrator. Provisioning change logs, retention and recovery drills remain release requirements.
- Remote provider, deployed CRM regression and production restore tests are not claimed as passed. Chromium testing uses synthetic source data and the real local Worker/D1.

## GitHub evidence

- Engine Chromium/core run: https://github.com/ushaone/usha-one-technologies/actions/runs/38505097422 (passed on d1ea33052a2124e6043bbbb62d563a12fda77d5c).
- Neo connector run: https://github.com/umakanthgilla/neo-school-india-website/actions/runs/38504992397 (passed on e501e3a0d6a43605a84f45d3ba63cc8accd3d0d7).
- Follow-up identity adapters add three locally passing tests (20 engine tests total); check the latest PR head CI for those additions.
- PRs: https://github.com/ushaone/usha-one-technologies/pull/3 and https://github.com/umakanthgilla/neo-school-india-website/pull/27.
