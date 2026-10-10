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
