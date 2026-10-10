# SEO Phase 2 — Offline Demo Walkthrough

This workflow requires no API keys, no outbound network calls, and no Cloudflare Worker deployment.

## Manual smoke test
1. Check out branch `seo-audit-engine-phase2`.
2. Serve the checked-out repository with a local static HTTP server, for example `python3 -m http.server 8000`. ES module imports may not work reliably from `file://`.
3. Open `http://localhost:8000/seo-offline-audit.html`.
4. Enter original page URL `https://www.example.org/`.
5. Select `tests/fixtures/seo-example-page.html`.
6. Click **Analyze HTML**. Expect a page title, one H1, a canonical, and the description.
7. Click **Download JSON Report**.
8. Open `http://localhost:8000/seo-audit-report.html`, select the downloaded JSON, and confirm the label **User-supplied offline HTML (not a live crawl)**.
9. Use **Print / Save PDF** and check mobile viewport layout.

## Safety checks
- No website is fetched by the offline tool. HTML files are analyzed in the browser.
- Local file is capped at 250 KB; JSON report viewer caps imports at 100 KB.
- The offline report uses `source: offline-html` and `liveCrawl: false`.
- Never describe this result as a verified live crawl, PageSpeed measurement, indexing check, or SEO ranking score.
- The private live audit API remains disabled unless explicitly configured with a safe-egress binding, approved hosts, authentication, and global rate limiting.

## Automated checks
Run `node --test tests/*.test.mjs` on Node.js 22 from repository root. GitHub Actions also runs the listed Phase 2 tests on branch pushes.

## Outstanding production blockers
DNS/IP-aware safe egress service implementation and verification, isolated Worker deployment, real-world browser tests, Cloudflare rate limiting, private access controls, security review, and public product requirements. Do not replace the production `tech` Worker.
