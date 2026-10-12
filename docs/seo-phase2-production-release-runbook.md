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

## Cloudflare upload correction and release evidence — 2026-10-11

- Owner-supplied build log confirms candidate version `197e1d1c-0774-4b38-9cc7-5865f17d0fac` uploaded from an isolated temporary website directory. This was `versions upload`, not a production deployment.
- Source candidate remains `997ba0872688c5473961960d66f42537e126bd92`. The seven-file requirement is the **diff from pre-release baseline `ed356568d30e66e5c5a07f4f9e41fe8fcd0ec0a2`**, not the moving `main` branch after merge; the complete website contains 24 files (plus 7 directories), including existing brand assets.
- Earlier version `a3a73bbb-4fff-4742-b906-82bd1611907c` uploaded Git metadata and Wrangler temporary files because `--assets ./` traversed the repository. Do not deploy that version. A new clean version does not delete old versions.
- Owner screenshot at 12:33 IST shows **Preview OFF, Production ON** for `tech`. This is dashboard evidence of routing configuration, not independent HTTP verification or proof of deletion. Never re-enable public previews on this Worker without containing the older versions first. Use authenticated preview access or a separate clean static QA Worker.
- Current production rollback version, provided by owner from the active deployment: `ee8d11eb-0de1-4060-ab86-78c0bf4cf0bd`. Recheck it immediately before production release.
- Direct HTTP checks from the agent environment returned 403 for the candidate homepage, SEO page and Git HEAD probe even before preview routing was disabled. These responses do not prove correct asset routing or successful deployed functional QA.
- Most recent previously verified complete browser CI: https://github.com/ushaone/usha-one-technologies/actions/runs/38107077517 at `09b5b37329ef278345e4fdc5bdcfb62a2b13f479`: 174 Node tests, 12 Chromium scenarios, 5 mobile semantic smoke pages, 25 WebKit layouts, PDF and ZIP passed. Recheck CI for later commits; physical iOS/Safari print and screen-reader review remain unverified.

### Prevent recurrence in development builds

`node scripts/stage-static-assets.mjs` stages exactly the reviewed 24 website paths from immutable HEAD Git blobs into `.static-assets`. Missing files or symlinks fail the build. Checkout metadata, untracked files, unexpected tracked files and stale output are excluded. Development Wrangler configuration points only to this staged directory and explicitly disables preview URLs. This does not change `main`, the seven-file candidate or the private live-audit Worker.

Run the staging script explicitly before Wrangler in CI. Workers Builds custom-build handling can differ from local Wrangler; do not depend on the local build hook alone. The existing dashboard temporary-directory command remains valid for the static branch, which has no build script or Wrangler config.

### Static-branch dashboard staging command (version upload only)

```sh
SEO_ASSET_TMP=$(mktemp -d) && git archive --output="$SEO_ASSET_TMP/site.tar" HEAD index.html seo.html seo-preflight.html seo-offline-standalone.html seo-audit-report.html ASSETS css js && mkdir "$SEO_ASSET_TMP/public" && tar -xf "$SEO_ASSET_TMP/site.tar" -C "$SEO_ASSET_TMP/public" && npx wrangler@4.149.0 versions upload --name tech --assets "$SEO_ASSET_TMP/public" --compatibility-date 2026-10-10
```

Do not restore `--assets ./`. The dashboard production command observed earlier (`npx wrangler deploy`) is not ready for the config-free static branch and must be corrected before any authorized merge triggers a build. After explicit production authorization, the same isolated staging sequence can use `wrangler deploy` instead of `wrangler versions upload`. Alternatively promote the exact verified clean version through Cloudflare's deployment mechanism, and reconcile Git only with automatic deployment behavior understood. Neither path is authorized yet.

### Remaining external release gates

- Deployed functional QA through authenticated preview access or a separate clean QA Worker; no public preview re-enable just to test.
- Actual-device checks or explicit owner acceptance of deferred checks.
- Verify current active production version and safe production build command; explicit final production authorization.
- Live audit remains NO GO until real gateway, firewall, IP pinning, authentication and global admission controls are provisioned and tested.

## Consolidated release review — 2026-10-11, evening IST

No production deployment or merge was performed. Live outbound scanning remains disabled.

### Verified implementation and tests
- Tested code commit: `318565dc451df3afbbc8f79b58a4d103c2f2e2c7`.
- Actions https://github.com/ushaone/usha-one-technologies/actions/runs/38120837885: both jobs completed successfully; every required test/export/package step was re-read from GitHub.
- Recorded local Node result: 177/177. CI covers 12 Chromium scenarios, 5 mobile semantic smoke pages, 25 WebKit viewport layouts, keyboard navigation, JSON export/import, PDF generation and ZIP validation. This review does not claim a new local browser run.
- Evening remote-ref check confirmed main `ed356568d30e66e5c5a07f4f9e41fe8fcd0ec0a2`, candidate `997ba0872688c5473961960d66f42537e126bd92` and tested development commit above.
- Seven-file blob integrity gate rerun successfully. PR #2 remains open, unmerged and mergeable.
- Safe staging, SSRF validation/IP-pinning code, authentication-before-body, hard deadlines, shared admission and negative tests are implemented. Real infrastructure security verification is still outstanding.

### Separate hosted QA evidence
A separate clean temporary QA Worker was created earlier, version `16142ca9-6ed1-4142-a750-a1da7befb5e2`, containing only the reviewed 24 website files. It did not modify production `tech`.
- Hosted homepage, SEO navigation, local URL preflight interaction, standalone HTML tool rendering and report viewer rendering were checked in the cloud browser.
- Owner mobile screenshot at 13:35 IST shows the enquiry form fitting the visible viewport. It does not establish mobile menu, export or complete accessibility behavior.
- Owner Mac Chrome screenshot at 13:38 IST confirms checklist generation with Test / https://example.com / Hyderabad and four consultation suggestions.
- Hosted HTML-file upload → JSON download → report import → print was not completed in that temporary environment. Equivalent automated Chromium/WebKit/export/PDF checks passed in CI.
- The temporary deployment had a one-hour lifetime. Do not advertise its old URL as a currently available preview; this evening review did not recreate or claim it.
- Physical iOS Safari, device-native Save PDF and full screen-reader review remain unverified. Do not repeat payment/Zero Trust setup merely to view the offline toolkit.

### Concrete release decision
Static code and automated QA are ready for owner review; production remains HOLD for deployment-setting verification and final authorization. Physical-device checks and hosted export-chain checks must either be completed or explicitly accepted as deferred.
1. Capture the current active `tech` version and ensure it is a known-good rollback. Previously owner-confirmed target: `ee8d11eb-0de1-4060-ab86-78c0bf4cf0bd`.
2. Review Cloudflare branch triggers and replace the config-free branch's incomplete production command with isolated staging under the owner's production authorization. Never upload the repository root.
3. Release only the exact reviewed static candidate, either through the prepared staging procedure or by promoting clean version `197e1d1c-0774-4b38-9cc7-5865f17d0fac` after confirming its provenance and settings. Merge/reconcile PR #2 only with automatic deployment behavior understood.
4. Perform post-release navigation, HTML/JSON and print checks. Roll back the Worker immediately on customer impact; then revert Git via a new commit and verify automated builds.
5. Keep private live audit NO GO until the real gateway/network/access/admission tests pass. This cannot be resolved by additional mocked tests.

This documentation-only checkpoint does not change tested code or static candidate files. Its commit skips CI intentionally; the passing CI evidence above belongs to the exact tested code commit, not to a new test run.
