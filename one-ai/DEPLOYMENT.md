# Deployment, security operations and handover

## Staging prerequisites

1. Authorize the deployment operator in the correct Cloudflare accounts. `wrangler whoami` in this session reported **not authenticated**. Do not paste signing keys into chat or commit them.
2. Reuse the existing USHA Supabase project and Auth. The recovered master handoff confirms a super_admin profile and public tables profiles, businesses, contacts, leads, opportunities and activity_log, plus intake RPCs. Live read-only inspection after the authorized resume confirmed leads.business_id and profile role/activity columns. Use the concrete Supabase connector and explicitly provision tenant/business/staff mappings. Resolve the existing security findings in SUPABASE_REVIEW.md before production.
3. Reconcile the Neo repository Worker (reviewed SHA `d503b535e59471938e80c6fb6a92b59636a1eda0`) with the current deployed Worker before connecting a staging clone. The archived finance-sequences-v2 package was inspected: it lacks Growth CRM tables and employee/me school_id. Existing individual employee accounts can be reused by the new gateway; shared admin/school logins cannot identify two independent approvers.
4. Provision two **new dedicated ONE AI staging D1 databases**, one per product. Use synthetic CRM records or a properly minimized staging dataset. Never apply these migrations to the existing school, finance or USHA CRM databases.

## Provision each engine

Copy `wrangler.example.toml` to ignored `wrangler.local.toml`. Fill verified staging IDs and the private CRM service binding. For Neo, change name, product, issuer, audience, DB and CRM service together. Keep public routes/preview URLs disabled. Use separate Cloudflare account permissions where organizational ownership requires it.

```sh
npm ci
npm run check
npm test
npx wrangler d1 migrations apply <dedicated-one-ai-staging-db> --remote --config wrangler.local.toml
npx wrangler secret put ONE_AI_TOKEN_SECRET --config wrangler.local.toml
npx wrangler secret put CRM_TOKEN_SECRET --config wrangler.local.toml
npx wrangler deploy --config wrangler.local.toml
```

These are operator instructions, **not steps executed remotely in this session**. Generate independent cryptographically random secrets (at least 32 bytes of entropy) through your secrets manager. The API's 32-character minimum only prevents obviously weak configuration; it cannot prove entropy. Never reuse Neo ADMIN_PASSWORD, Supabase service keys, a shared product key, or a test credential.

After applying the schema, use the database administration surface to provision one immutable instance row and individual principals, substituting validated identifiers:

```sql
INSERT INTO one_ai_instance(singleton,product) VALUES(1,'usha-one');
INSERT INTO one_ai_principals(tenant_id,actor_id,role,active,auth_version)
VALUES('customer-tenant','individual-staff-id','staff',1,1);
INSERT INTO one_ai_principals(tenant_id,actor_id,role,active,auth_version)
VALUES('customer-tenant','different-manager-id','manager',1,1);
```

Use `neo-school-india` in Neo's database. Principal provisioning is an operator action; no browser endpoint can self-register permissions. Record operator grants/revocations in your Cloudflare/operator change log. Revocation example: `UPDATE one_ai_principals SET active=0,auth_version=auth_version+1 WHERE tenant_id=? AND actor_id=?` through a parameterized administrative process. Keep signer version in the CRM's staff provisioning synchronized. The engine does not create a new customer identity from a browser request.

## Real integration

Deploy Neo's standalone context connector with a staging clone binding and explicit tenant-to-school map. Its code issues SELECT queries only; Cloudflare D1 bindings themselves are not SQL-level read-only credentials, so deployment permissions and code review remain essential. Deploy USHA's `integrations/usha-supabase-context.mjs` using its example config, explicit scopes and a separately provisioned restricted read-only Data API credential. Bind each engine only to its organization's connector.

Deploy the new `integrations/gateway-worker.mjs` separately per product using its example config, existing Supabase or Neo identity provider, and explicit SESSION_MEMBERSHIPS_JSON. Mount `/api/one-ai/*` on the approved CRM origin, or mount the server-only CRM client behind existing session middleware. Resolve stable individual staff ID and tenant from the existing verified session and permissions. Protect the proxy against CSRF and cross-origin calls, revoke departed staff, and use shorter sessions/MFA according to existing organization policy. Mount the review panel after this proxy works. Do not issue different identities on top of a single shared password to simulate separation of duties.

Enable Workers AI only for the intended account/environment and check model availability, data-processing requirements, quotas and budget before a live trial. Prompts contain only enum purpose/status. Native-language reviewers must assess Telugu, English and Hindi for accuracy and tone. Script detection is not translation-quality certification.

## Required remote staging evidence

- Authenticated admin readiness; unauthenticated/wrong-product/wrong-audience/expired/revoked identity denial.
- Cross-customer and cross-school reads, lists, changes and connector queries denied.
- Actual CRM lead ownership confirmed with synthetic records; backend identity is individual and revoked promptly.
- Real model calls in all three languages; reviewed by Telugu/Hindi/English speakers; no personal data in provider inputs/logs.
- Staff create/edit/review; different manager approve/reject; race/stale version returns 409; audit rows match successful writes only.
- Rejected or edited approved drafts require fresh review; no outbound or manual mark-sent route succeeds.
- Existing websites, SEO, school portals, finance and admissions smoke tests on staging remain unchanged.
- Restore a dedicated ONE AI DB snapshot and roll back the engine deployment in staging; confirm records/audit persist.

`/ready` checks configuration presence and DB identity only. It is not evidence that credentials, providers, remote bindings or quotas work.

## Production gate and rollback

Do not merge for production activation or deploy to production until all above evidence is recorded and the owner authorizes the concrete release. Outbound requires the additional gates in OUTBOUND.md; an approved draft is not authorization to transmit.

Back up the dedicated database before migrations and record deployment/version IDs. Migrations are additive; retain them during code rollback. Disable the new CRM integration feature or remove its service binding to stop new calls, revoke principals if needed, and restore the previous Worker version. Do not downgrade to the insecure foundation API or delete audit history. Restore a DB snapshot only through an explicitly approved recovery plan; replay/duplicate handling and audit preservation must be reviewed first. Existing operational CRM databases are unaffected by the engine's schema.

Restrict Cloudflare admin access, enable account audit logs/alerts, monitor authentication failures, 409/429/5xx rates and inference spending. Payloads/tokens/contact details must not be logged. Define a customer-approved retention/deletion policy before production: append-only SQL triggers protect audit records from ordinary app updates, but they are not tamper-proof against a database administrator. No tenant purge endpoint is shipped.

## Handoff reconciliation completed

Inspected the uploaded `USHA_ONE_TRANSFER_PACK.zip` / `USHA_ONE_MASTER_HANDOFF.txt` and `neo-lead-crm-api-worker-finance-sequences-v2.zip`. The USHA handoff was followed by read-only live schema/policy verification after an owner-authorized project resume. The Neo archive supports school enquiries but not the newer Growth CRM connector query. Keep `ENABLE_GROWTH_CONTEXT=false` unless the current staging schema is verified. The identity gateway intentionally fails closed for the archived employee/me response until current school identity is available.

Only remote catalog metadata and zero-row schema validation queries were read; no customer data or credentials were retrieved. The recovered files do not prove which Cloudflare Worker version is currently deployed.
