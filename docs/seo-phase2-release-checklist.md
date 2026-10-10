# USHA ONE SEO Phase 2 — deployment and release checklist

## What is implemented
- Existing production marketing website and `wrangler.jsonc` are unchanged.
- Standalone browser URL preflight and offline HTML evidence parser.
- Bounded HTML fetcher with exact hostname allowlist, HTTPS-only URLs, manual redirect handling, 250 KB response cap and 5-second timeout.
- Isolated `worker/seo-audit-phase2.js` private API, disabled by default.
- Offline HTML audit browser UI, downloadable JSON report and a printable local report viewer; all linked from the SEO services page on this branch.
- Integration and regression tests run through GitHub Actions.
- A separate `wrangler.seo-preview.jsonc` with Worker name `usha-seo-audit-preview`.

## What is NOT finished
The **offline SEO toolchain is feature-complete on the development branch** but not yet browser-smoke-tested or deployed. This is **not a production-ready public website crawler**. The exact hostname allowlist is not a substitute for DNS resolution and network-level egress protection against SSRF, DNS rebinding and private address destinations. There is no authenticated public dashboard, real-site verification, multi-page crawling, PageSpeed measurement or Search Console integration. The report viewer supports browser Print / Save PDF, not server-side PDF generation. No numeric SEO score is claimed.

## Private preview configuration
The committed preview configuration intentionally disables live crawling. Do not enable it merely because offline unit tests pass. To enable an **internal, controlled** preview in a security-reviewed environment, configure:
1. `ENABLE_PRIVATE_AUDIT=true` (only after controls below)
2. `AUDIT_ALLOWED_HOSTS` as an explicit comma-separated set of owned, approved public domains (no wildcard).
3. `AUDIT_PREVIEW_TOKEN` as a secret, never a checked-in variable or public browser token.
4. `AUDIT_RATE_LIMITER` as a globally enforced rate limiter with `limit({key})` returning `{success:boolean}`.
5. Mandatory `AUDIT_SAFE_FETCH` binding exposing `fetch(url, options)` through a separately audited safe-egress service. This service must verify public DNS and final destination IP at connection time, block private/reserved ranges and rebinding, enforce the exact approved hostname and reject redirects. The application refuses live audits if this binding is absent. No safe-egress implementation is included yet. The controlled fetch helper now also requires an explicitly injected fetcher; it cannot fall back to global fetch. This is defense in depth, not proof of DNS/IP-level SSRF protection.
6. Private access policy for the entire preview Worker; avoid exposing the endpoint publicly, even with a bearer token.

No values or secrets have been configured in the repository. The API fails closed if any of these required application settings are absent. The default health endpoint exposes only preview state.

## API contract
`POST /api/seo/audits` with JSON `{"url":"https://approved-owned-domain.example/path"}` and `Authorization: Bearer <private-preview-token>`. Successful response contains `status:complete`, `liveCrawl:true`, fetched timestamp, title, description, H1, canonical, robots meta, viewport, link counts and per-check observations. Disabled configuration returns HTTP 503. Invalid URL returns 400. Unapproved domain returns 403. Rate limit returns 429. Failed upstream returns 502 without upstream details.

## Security and release gates
- Verify GitHub Actions is green for the latest commit. An empty GitHub commit-status response is NOT evidence that Actions passed; open the actual workflow run and inspect its conclusion.
- Add DNS/IP-aware egress restrictions, then test DNS rebinding, CNAME-to-private, metadata IP, redirect-to-private, encoded IP variants, and IPv6.
- Verify actual Cloudflare rate-limiter binding, access policy, outbound restrictions and real Worker deployment in isolated preview.
- Check real owned pages with consent and compare findings against source HTML manually.
- Offline report viewer and browser print/PDF are implemented; complete browser-based mobile, accessibility and end-to-end smoke tests before deployment.
- Only then discuss public launch. Do not merge this branch into production `main` or deploy to Worker `tech` until all release gates pass.

## CI
`node --test tests/seo-*.test.mjs`

## Distinct release decisions
- **Offline tools:** Can be considered for a static-assets-only release after current Actions success and a browser smoke test. They do not enable live auditing or require cloud API secrets.
- **Private live API:** Continue to keep disabled. Its safe-egress gateway, rate limiter, private access controls and isolated deployment have not been verified.
- **Public live crawling:** Blocked until separate threat model, DNS/IP and operational checks are complete. Do not claim a release date or production readiness from unit tests alone.
