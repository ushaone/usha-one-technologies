# USHA ONE SEO Phase 2 — deployment and release checklist

## What is implemented
- Production marketing website and Worker config remain unchanged; the static-only release candidate adds one discoverable SEO Services homepage navigation link.
- Standalone browser URL preflight and offline HTML evidence parser.
- Bounded HTML fetcher with exact hostname allowlist, HTTPS-only URLs, manual redirect handling, 250 KB response cap and 5-second timeout.
- Isolated `worker/seo-audit-phase2.js` private API, disabled by default.
- Offline HTML audit browser UI, downloadable JSON report and a printable local report viewer; all linked from the SEO services page on this branch.
- Integration and regression tests run through GitHub Actions.
- A separate `wrangler.seo-preview.jsonc` with Worker name `usha-seo-audit-preview`.

## What is NOT finished
The **offline SEO toolchain is feature-complete on the development branch and verified in headless Chrome, but not deployed**. This is **not a production-ready public website crawler**. The exact hostname allowlist is not a substitute for DNS resolution and network-level egress protection against SSRF, DNS rebinding and private address destinations. There is no authenticated public dashboard, real-site verification, multi-page crawling, PageSpeed measurement or Search Console integration. The report viewer supports browser Print / Save PDF, not server-side PDF generation. No numeric SEO score is claimed.

## Private preview configuration
The committed preview configuration intentionally disables live crawling. Do not enable it merely because offline unit tests pass. To enable an **internal, controlled** preview in a security-reviewed environment, configure:
1. `ENABLE_PRIVATE_AUDIT=true` (only after controls below)
2. `AUDIT_ALLOWED_HOSTS` as an explicit comma-separated set of owned, approved public domains (no wildcard).
3. `AUDIT_PREVIEW_TOKEN` as a secret, never a checked-in variable or public browser token.
4. `AUDIT_ADMISSION` namespace bound to `SeoAuditAdmission`, always addressed as `seo-private-global-v1`. Transactional storage enforces a rolling 10/minute ceiling and two 30-second admission leases. The 30-second hold is deliberately conservative (successful calls also retain it). Code/migration exist; real deployment and cross-location behavior remain unverified.
5. Mandatory `AUDIT_SAFE_FETCH` binding exposing `fetch(url, options)` through a separately audited safe-egress service. This service must verify public DNS and final destination IP at connection time, block private/reserved ranges and rebinding, enforce the exact approved hostname and reject redirects. The application refuses live audits if this binding is absent. A separate, test-covered Node.js safe-egress **core** now exists in `gateway/seo-safe-egress.mjs` (CNAME/public IPv4 validation, IPv6 deny-by-default, IP-pinned TLS, redirects denied and bounded HTML). It is not a deployed Cloudflare binding, has not been independently audited, and has no verified network firewall. The operational safe-egress gateway is therefore still missing. The controlled fetch helper now also requires an explicitly injected fetcher; it cannot fall back to global fetch. This is defense in depth, not proof of DNS/IP-level SSRF protection.
6. Private access policy for the entire preview Worker; avoid exposing the endpoint publicly, even with a bearer token.

No values or secrets have been configured in the repository. The API fails closed if any of these required application settings are absent. The default health endpoint exposes only preview state.

## API contract
`POST /api/seo/audits` with JSON `{"url":"https://approved-owned-domain.example/path"}` and `Authorization: Bearer <private-preview-token>`. Successful response contains `status:complete`, `liveCrawl:true`, fetched timestamp, title, description, H1, canonical, robots meta, viewport, link counts and per-check observations. Disabled configuration returns HTTP 503. Invalid URL returns 400. Unapproved domain returns 403. Rate limit returns 429. Failed upstream returns 502 without upstream details.

## Security and release gates
- Verify GitHub Actions is green for the latest commit. An empty GitHub commit-status response is NOT evidence that Actions passed; open the actual workflow run and inspect its conclusion.
- Add DNS/IP-aware egress restrictions, then test DNS rebinding, CNAME-to-private, metadata IP, redirect-to-private, encoded IP variants, and IPv6.
- Verify actual Cloudflare shared admission binding, access policy, outbound restrictions and real Worker deployment in isolated preview.
- Check real owned pages with consent and compare findings against source HTML manually.
- Offline report viewer and browser print/PDF are implemented. Automated headless Chrome checks have verified offline upload, error handling, JSON export/import, URL preflight, a narrow viewport and HTML injection as literal text. Automated Print-to-PDF now generates and checks an actual PDF in Chrome. Manual Safari/WebKit, keyboard/accessibility and physical-device PDF printing remain before deployment.
- Only then discuss public launch. Do not merge this branch into production `main` or deploy to Worker `tech` until all release gates pass.

## CI
- `node scripts/build-seo-standalone.mjs --check`
- `node --test tests/seo-*.test.mjs`
- `node scripts/seo-browser-smoke.mjs` (requires Chrome/Chromium)
- `node scripts/seo-print-pdf-smoke.mjs` (requires Chrome/Chromium)
- Verified green run: https://github.com/ushaone/usha-one-technologies/actions/runs/38075749253 — 106 unit tests, 7 browser scenarios and Chrome-generated PDF smoke test passed.

## Distinct release decisions
- **Offline tools:** Can be considered for a static-assets-only release after current Actions success and a browser smoke test. They do not enable live auditing or require cloud API secrets.
- **Private live API:** Continue to keep disabled. Its safe-egress gateway, rate limiter, private access controls and isolated deployment have not been verified.
- **Public live crawling:** Blocked until separate threat model, DNS/IP and operational checks are complete. Do not claim a release date or production readiness from unit tests alone.

## 11 October 2026 engineering update
- Input body handling now caps streaming/chunked JSON at 4096 bytes rather than buffering unlimited request text.
- Padded default-port URL variants are rejected in both entrypoint and controlled fetch.
- Adversarial URL, authorization, no-redirect, no-CORS, DNS/CNAME/IP, gateway pinning and unsafe-egress regression suites were added. Mock-based tests do not prove deployed gateway security.
- CI adds Chromium semantic/keyboard/mobile checks and macOS Playwright WebKit mobile/file export/import smoke (WebKit is not native iOS Safari).
- The report viewer now describes imported live-HTML claims as unverified rather than authorized.
- Cloudflare Workers native rate-limiting bindings are per-location and eventually consistent, **not globally exact**; the new Durable Object admission implementation still requires deployed cross-location verification.
- The deployment/rollback plan is in `docs/seo-phase2-production-release-runbook.md`. Continue to require actual production deployment authorization.

## Completion-agent hardening (11 October 2026)
- 174 Node tests pass locally, including 14 new deadline/admission cases. Consult the latest Actions conclusion for CI evidence.
- Request bodies (2s), admission calls (2s), and HTML fetch plus stream consumption (5s) now have Promise-level deadlines even when adapters ignore AbortSignal. Cancellation is requested without awaiting a stuck cancellation promise.
- Authentication precedes body consumption for configured private endpoints.
- Shared admission fails closed on absent bindings, storage outage, malformed leases and saturation. Its transaction model is unit-tested, not a substitute for Cloudflare runtime verification.
- Preview config adds only its own SQLite Durable Object migration. Live audit remains false, allowlist empty, and safe-egress binding absent.
- WebKit CI now adds 360/420/768/1440px layouts and real Tab input across all five pages to the existing 390px upload/export/import flow.
- This workspace has no installed browser executable. Fresh browser verification is delegated to the existing Actions jobs, not claimed as a local pass.
