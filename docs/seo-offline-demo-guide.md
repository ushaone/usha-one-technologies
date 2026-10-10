# SEO Phase 2 — Offline Demo Walkthrough

This workflow requires no API keys, no outbound network calls, and no Cloudflare Worker deployment.

## Fastest no-install route
1. Download `seo-offline-standalone.html` from the development branch and open it in Chrome, Edge or Safari as a local file. It contains the HTML analyzer and recommendation code inline and needs no web server or API token.
2. Enter the original website URL only for resolving links; choose a saved `.html` or `.htm` file (maximum 250 KB).
3. Click **Analyze HTML**, review the observations, and download `usha-one-offline-seo-report.json`.
4. For a printable report, also download `seo-audit-report.html` into the same folder, open it and import the JSON. Use the browser's **Print / Save PDF** control.
5. The standalone file does **not** fetch the website; the result is based only on user-provided HTML. The report viewer is a second local file, not a requirement for analyzing HTML.

The site-served modular `seo-offline-audit.html` remains available for development. A reproducible builder keeps the standalone file in sync: `node scripts/build-seo-standalone.mjs` (or `--check` in CI).

## Manual smoke test (modular web version)
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
Run `node --test tests/*.test.mjs` on Node.js 22 from repository root. GitHub Actions checks the standalone generated file matches the source, runs all Phase 2 unit tests, and runs `node scripts/seo-browser-smoke.mjs` in real headless Chrome to check upload, blank-file errors, JSON import/export, URL preflight, homepage navigation, SEO mobile menu, narrow mobile layout and HTML injection safety. It also runs `node scripts/seo-print-pdf-smoke.mjs` to generate and validate a printed PDF. Safari/WebKit and physical-device PDF printing are not covered.

## Outstanding production blockers
DNS/IP-aware safe egress service implementation and verification, isolated Worker deployment, real-world browser tests, Cloudflare rate limiting, private access controls, security review, and public product requirements. Do not replace the production `tech` Worker.
