# USHA ONE — Real SEO Audit Backend (Phase 2 design)

Status: design specification only. The current preflight page does **not** fetch websites or issue real SEO scores. Do not present its output as a live audit.

## Deployment separation
Keep the public marketing site and `seo-platform-phase1` unchanged. Develop the backend on `seo-audit-engine-phase2`. Use a separate Cloudflare Worker and preview hostname; do not modify the production `tech` Worker or promote until verified.

## Endpoint contract
`POST /api/seo/audits` accepts `{"url":"https://example.com/"}` with strict content-type and request-size limits. Return a generated audit ID, timestamp, source URL, measured facts, warnings, and per-check `passed | failed | unknown`. Never infer a score from unchecked facts. Do not store contact details in this phase.

## SSRF and network security (blocking)
- Only accept absolute `https:` URLs for remote scans, with hostname in ASCII/punycode and no credentials, IP literals, localhost, internal DNS suffixes or nonstandard ports.
- DNS resolution and outbound connectivity must be constrained at the network boundary. String-only hostname checks are insufficient against DNS rebinding, redirects, CNAMEs, or provider-specific private IP ranges.
- Disable redirects by default. If enabled later, validate each hop's DNS and destination independently, with a small redirect cap.
- Block IPv4 and IPv6 loopback, link-local, private, multicast, metadata and reserved ranges. Do not fetch user-specified arbitrary paths to internal resources.
- Apply per-IP and per-origin rate limits, concurrency limits, request timeouts, a small HTML response cap, and a strict maximum crawl depth (start with one page).
- Never forward client cookies, authorization headers or user-controlled headers. Do not execute page scripts.
- Prevent cache poisoning and cross-origin reads: narrow CORS to approved origins; no wildcard CORS on private results.
- Require explicit consent/authorization before integrating Search Console or GA4.

## Initial audit checks
Fetch one public HTML document (after network controls). Record final URL, HTTP status, content-type, HTML title, meta description, first H1, canonical URL, robots meta directive, viewport meta, and internal link count. Mark checks `unknown` when fetch/parsing fails. Avoid claims about actual indexing or ranking. Add robots.txt and sitemap only after safe-fetch and caching tests.

## Reporting
Show observed evidence and timestamps, actionable suggestions and check coverage. Avoid a headline numeric score until the methodology and unknown-check handling are documented. PageSpeed Insights and Search Console require separate opt-in integrations and quota/privacy controls.

## Required verification
1. Unit tests for URL parsing, invalid schemes, IP literals, credentials, ports, IDN/punycode and redirect behavior.
2. Integration tests using mocked fetch/DNS with SSRF, rebinding and metadata endpoint attempts.
3. Timeout, HTML size, rate limit and CORS tests.
4. Browser tests for loading, errors, mobile UI and download.
5. Human review of audit accuracy on permitted public sites before any production rollout.

## Release gates
Do not deploy the backend to production until all security tests pass, the deployment target is isolated, and the owner approves. No automatic production promotion.

## Security architecture sign-off (11 October 2026)

**Trust boundary:** browser/client → independently protected private preview endpoint → bearer-authenticated Worker → globally enforced shared quota/concurrency coordinator → **separately operated, IP-pinning safe-egress gateway** → public HTTPS origin. The Cloudflare Worker **must never** call native `fetch` on a user-supplied audit URL, and the gateway must not accept arbitrary public callers.

**Gateway acceptance contract (not yet implemented/provisioned):**
1. Resolve the exact, approved ASCII hostname through a trusted resolver; inspect the entire CNAME chain (or reject unresolved/ambiguous chains), and reject any result with an IPv4 or IPv6 loopback, private, link-local, carrier-grade NAT, documentation, multicast, reserved, or cloud metadata destination. Include IPv4-mapped IPv6, hexadecimal, octal and single-integer IPv4 representations in negative fixtures.
2. Enforce the approved hostname and a constrained path policy. Pin the validated public address to the actual TCP/TLS connection; verify the TLS certificate against the original hostname with SNI. **Never** resolve DNS once to check and then reconnect by name with an unpinned `fetch` — this is vulnerable to DNS rebinding.
3. Reject redirects, proxies, CONNECT requests, user-supplied Host/Authorization/Cookie headers, non-HTTPS ports, non-HTML MIME types, oversized headers and response streams; allow one request only, with a hard overall timeout and byte cap.
4. Isolate egress network permissions so the gateway cannot connect to internal networks, metadata IP ranges, or private cloud control planes even if validation fails. Deny by default and record redacted audit logs without secrets.
5. Require gateway-to-Worker authentication/identity, Cloudflare Access or equivalent on the private entrypoint, a shared **global** quota and concurrency budget, and per-approved-origin quotas. Audit unauthorized calls and do not leak backend errors. Apply emergency disable and secret-rotation procedures.

**Important Cloudflare limitation:** the Cloudflare Workers Rate Limiting binding offers *per-location*, eventually consistent enforcement, **not** a globally exact quota. A real cross-location quota/concurrency requirement needs an additional shared coordinator (such as a carefully designed Durable Object), as well as isolated gateway controls. Reference: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.

**Verified scope:** application-level input/body bounds, explicit host validation, bearer token, fail-closed binding checks, rate-limit adapter handling, and no automatic redirect following have Node regression coverage. **Not verified:** actual DNS/CNAME chain validation, TLS/IP pinning, gateway firewall, globally shared quotas, external identity controls, and isolated deployment. Mocked fetch tests cannot stand in for those network-layer acceptance tests.

**Decision:** leave `ENABLE_PRIVATE_AUDIT=false` and `AUDIT_ALLOWED_HOSTS=""` until gateway infrastructure and security review are complete. Do not publish live scanning or market simulated results as measured live results.

## Shared admission and deadline implementation — 11 October 2026
The private Worker requires `AUDIT_ADMISSION` instead of the former generic `AUDIT_RATE_LIMITER` adapter. It uses one fixed Durable Object ID for all callers and destinations. `worker/seo-admission.mjs` stores admissions and leases in a storage transaction; no per-isolate map or per-location rate-limit binding is accepted as a substitute. The preview-only migration declares a SQLite class. No production configuration changes.

The coordinator permits two outstanding 30-second leases and at most ten starts in a rolling minute. Slots are deliberately NOT released early, including on success: aborting a Worker promise does not prove a remote gateway stopped. This can reduce actual throughput below ten/minute. The gateway must independently enforce a total lifetime shorter than 30 seconds, including ingress/queue delay; reject stale admissions, and prevent direct unauthenticated access. Those controls cannot be inferred from this unit-tested coordinator.

Application deadlines cover request body (2s), admission including JSON response (2s), and HTML fetch/body (5s), including hung adapters and streams. The isolated Node core retains bounded DNS and HTTPS operations, deny-by-default IPv6, original-host SNI/certificate validation and a pinned public IPv4 lookup. The Worker never substitutes native fetch for a missing safe-egress service.

Required infrastructure evidence before enabling: actual gateway deployment and identity, deny-private firewall, signed or authenticated admission/deadline propagation to gateway, no delayed fetch after lease expiry, cross-location saturation and storage failure tests, and real TLS/IP/DNS-rebinding negative tests. Gateway ingress/adapter implementation depends on the selected host/network and identity mechanism; none is provisioned in this repository. Keep the flag false.

Cloudflare references: https://developers.cloudflare.com/durable-objects/api/namespace/ and https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ . The latter documents strongly consistent transactional storage; runtime evidence is still required.
