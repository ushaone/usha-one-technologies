# USHA ONE Technologies — SEO Phase 2 release and rollback runbook
Date: 2026-10-11. Owner authorization is required for **production deployment only**.

## Release A — Static offline SEO tools (PR #2)
Source: `seo-offline-release-candidate` → `main`, PR https://github.com/ushaone/usha-one-technologies/pull/2.
Scope is **exactly** seven files: `index.html`, `seo.html`, `css/seo.css`, `js/seo.js`, `seo-preflight.html`, `seo-offline-standalone.html`, `seo-audit-report.html`. No backend, Worker code, secrets or live crawling.

### Preconditions
1. Require latest `seo-audit-engine-phase2` commit CI success, including Node tests, independent seven-file Git blob equality gate, Chrome mobile/functionality tests, keyboard/semantic accessibility smoke, PDF generation and offline ZIP integrity.
2. Check PR #2 still contains exactly seven approved static files; each must have the same Git blob SHA as the tested development revision. Do **not** merge additional `worker/`, `.github/`, `wrangler*`, or `docs/` files to production.
3. Have a reviewer perform mobile and desktop navigation, keyboard focus/labels, actual Safari/WebKit (macOS/iOS) and physical-device Print/Save PDF checks. Automated Chrome tests are not a substitute. Record platform/version and result before public launch.
4. Confirm Cloudflare `tech` Worker is connected to `main` (and what its build/deploy triggers do) with the account owner. Create a rollback reference to the current deployed Worker version and `main` commit `ed356568d30e66e5c5a07f4f9e41fe8fcd0ec0a2` (as observed when this runbook was written; recheck at release time).

### Production authorization and publish
- Obtain explicit final owner authorization after all gates.
- Merge PR #2 only when the branch/CI/preview evidence has not changed. Confirm the Cloudflare build is triggered by the intended branch. If the merge triggers a deployment, treat merge as a deployment and do not do it ahead of authorization.
- Confirm production homepage's SEO Services navigation, `seo.html`, three offline tool links, asset loading, local HTML JSON export and report import/Print PDF. Check 360–420 px layout and at least one desktop browser.
- Clearly label URL Preflight as local URL parsing, Offline HTML as user-supplied HTML, and reports as *not* measuring Google indexing, rankings or Core Web Vitals. No live domain scan.

### Rollback
1. If customer impact occurs, disable/rollback the Cloudflare Worker deployment to the last known-good release **using the account's verified rollback/version mechanism**; do not assume Git revert alone instantly undoes a deployed Worker.
2. Revert PR #2 merge (or restore approved static files from known-good `main`) using a new reviewed commit; do not force-reset `main`. If Cloudflare auto-deploys from Git, verify the rollback build/deploy succeeds.
3. Smoke-check production homepage, branding, navigation, assets and pre-existing technology audit. Validate offline SEO links are absent again. Capture incident evidence and root cause.

## Release B — Private Live SEO Audit
Current status: **NO GO**. The preview Worker is disabled and its required network-safe egress service is not provisioned.
- Provision a separate gateway that revalidates DNS/CNAME/IP and pins the validated public IP to the TLS connection; deny private/reserved/cloud metadata networks at the network layer.
- Deploy a separate preview target with private access/identity controls; configure a server-side secret, an owner-approved hostname list, the `AUDIT_ADMISSION` Durable Object migration/binding (fixed global instance), and secure gateway binding. The source implementation exists but has not been deployed or tested across locations. Cloudflare's built-in Workers rate limiting alone is per-location/eventually consistent, not a global budget.
- Pass negative SSRF cases including rebinding between lookups, CNAME→private, IPv4/IPv6 literals/variants, metadata addresses, redirects, mixed DNS records, timeouts, oversized response, cross-origin headers, authentication and rate/concurrency saturation, **against the real gateway and deployed binding**.
- Test a permitted owned live domain under consent. Verify headers/content against a manually inspected single-page source. Rotate test credentials; monitor logs. Get a separate explicit owner release authorization.
- If any requirement fails, keep `ENABLE_PRIVATE_AUDIT=false` or remove the isolated preview route. Never route the crawler through the production marketing Worker.

## Release C — Public live audit
Not in scope for the offline PR. Requires separate security/privacy/product evaluation, abuse controls, monitoring and explicit authorization.

## Evidence
- Baseline Actions run: https://github.com/ushaone/usha-one-technologies/actions/runs/38105136473 (success, development commit `51282a2`).
- Consult the **latest** development commit's GitHub Actions run after security/QA changes before asserting its test counts or release readiness.
- Static PR: https://github.com/ushaone/usha-one-technologies/pull/2.
- Platform rate-limit behavior: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.
