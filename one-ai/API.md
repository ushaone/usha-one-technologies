# API and identity contract v1

Use a private service binding from a CRM server proxy. No CORS wildcard or browser-managed signing key is supported. Protect the host proxy using its existing individual-user session, origin/CSRF controls, tenant mapping and login throttling. Never derive `actorId`, `tenantId`, role, issuer or product from request JSON.

## Token

Authorization is `Bearer <base64url(JSON claims)>.<base64url(HMAC-SHA256)>`. This is the versioned ONE AI token protocol, **not a JWT**. Use `signClaims()` from `auth.mjs` on the server. Claims:

| Field | Source |
|---|---|
| `iss` | Exact configured CRM issuer |
| `aud` | Exact product/environment audience |
| `product` | `usha-one` or `neo-school-india`, matching the deployment |
| `tenantId` | Verified customer/branch tenant mapping |
| `sub` | Stable individual staff ID, never shared-login display name |
| `version` | Provisioned principal `auth_version` |
| `iat`, `exp` | Integer epoch seconds, lifetime at most 300 seconds |
| `jti` | Random unique identifier for tracing; tokens may be reused during their short lifetime |

Database principal membership and active/version status are rechecked for each API request. Role is loaded from the database (`viewer`, `staff`, `manager`, `admin`). To revoke access, set active=0 or increment auth_version. No public role-grant endpoint exists. The old foundation tokens are intentionally rejected.

## Routes

| Method and path | Input / behavior |
|---|---|
| GET `/health` | Liveness only; no DB/provider claim; outbound false |
| GET `/ready` | Admin-only configuration/database check; does not call CRM/model or certify live readiness |
| GET `/api/drafts` | Optional `leadId`, `state`, `before`; 50 items and `nextCursor` (UUID lexical cursor) |
| POST `/api/drafts/generate` | `{leadId,language}`; `Idempotency-Key` required |
| POST `/api/drafts` | `{leadId,language,message}`; manual text; lead ownership still verified; `Idempotency-Key` required |
| GET `/api/drafts/:id` | Tenant-scoped draft |
| GET `/api/drafts/:id/events` | Tenant-scoped audit; oldest 500 events, version ordered |
| POST `/api/drafts/:id/transition` | `{action,version}`; edit also requires `message` |
| POST `/api/drafts/:id/send` | Always blocked (409); no recipient contacted |

`language`: en, te, hi. `action`: edit, submit, approve, reject. Edits are allowed only in draft/rejected/approved states, by the creator or manager/admin; pending review must be rejected before editing. Approval requires a manager/admin distinct from creator, reviewer and last editor. `version` must match the latest saved version, or 409 requires reload. Unknown fields are rejected. The caller cannot override IDs, timestamps, product, tenant, state, actor, approval or delivery status.

Identifiers: 1–128 ASCII letters/digits with `_ . : @ -` after the first character. Draft message: 1–4000 characters. JSON body limit: 12000 bytes; content-type application/json required. Limit: 120 API calls/minute and 10 new drafts/minute per actor/tenant. Concurrent generated requests may both consume inference before one wins the unique idempotency key; persistence is deduplicated. Use a stable request key while retrying an uncertain creation; reusing it with different input returns 409. A replay returns the current draft, possibly edited since creation.

## Connector contract

The engine signs a separate 60-second token with `CRM_TOKEN_SECRET`, audience `one-ai-crm`, issuer equal to the engine audience, and `leadId` in addition to identity scope. `CRM.fetch(GET /context/:leadId)` must verify the token and look up the lead in the scoped CRM. It returns exactly `{product,tenantId,leadId,status}`. Unowned/missing leads return 404. Never return arbitrary notes or contact details.

Neo IDs: `growth:<lead_id>` or `enquiry:<id>`. Tenant mapping is explicitly configured in the Neo connector. USHA uses lead UUIDs and an explicit tenant-to-business/staff mapping. The concrete `usha-supabase-context.mjs` connector filters the verified `leads.id` and `leads.business_id` columns and verifies active staff. It is implemented/tested but not deployed. See SUPABASE_REVIEW.md for credential provisioning and existing CRM security blockers.

## UI mounting

Import `mountReviewPanel` from `integrations/review-panel.mjs`, include its scoped CSS, and supply a selected CRM lead ID plus `api(path,options)`. That callback calls your authenticated same-origin server proxy and throws the returned error on non-2xx responses. It must not expose engine signing keys to the browser. The UI always defers authorization and version enforcement to the server. Rendered draft text is untrusted even after model output validation.

## Existing identity gateway

`integrations/gateway-worker.mjs` serves the restricted `/api/one-ai/drafts...` route using existing bearer sessions. Deploy it separately per product, binding only that product's engine. It replaces the source session with a short-lived engine credential; the original token, Supabase user metadata and Neo HR fields are never forwarded.

- USHA: verifies the bearer with the configured Supabase project's `/auth/v1/user`, using a publishable/anon key, HTTPS, no redirects and a bounded timeout. Roles from `user_metadata` are ignored. Anonymous and nonprovisioned users are denied.
- Neo: asks the existing Worker through a private `NEO_APP` binding at fixed `/api/employee/me`. The response must contain individual `account_id` and matching `school_id`; an older v2 response missing school identity is rejected.
- `SESSION_MEMBERSHIPS_JSON` is an operator-managed object keyed by the verified source user/account ID, e.g. `{"individual-id":{"tenantId":"test-tenant","authVersion":1,"active":true,"schoolId":"NEO-SCHOOL-ID"}}`. `schoolId` is required only for Neo. The same individual ID/version must be provisioned in the engine. Roles remain in engine D1, not the mapping or request.
- If an Origin header is present, it must equal configured `CRM_ORIGIN`. No cookie authentication, token-exchange endpoint, wildcard CORS or send route is exposed. Apply edge rate controls to the gateway before public activation.

The new gateway is implemented and tested with source-provider fixtures; its actual bindings, existing sessions and approved user mappings still require remote staging verification.
