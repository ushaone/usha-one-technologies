# Existing USHA Supabase review — 2026-10-14

The existing `ushaone` project was resumed with explicit owner authorization and reached `ACTIVE_HEALTHY`. No new Supabase project was created. After health was confirmed, catalog queries verified the original CRM schema. No customer rows, user records, tokens or secrets were fetched. No production schema, policy or grant was changed.

During startup, catalog queries briefly returned no application tables; the final healthy-state queries found the original tables. Startup results must not be treated as missing or lost data.

## Verified integration contract

- `leads`: UUID `id`, nullable UUID `business_id`, nullable UUID `assigned_to`, text `status`.
- `business_id` references `businesses.id`; unassigned/null business leads must not be shared with a tenant.
- `profiles`: UUID `id` references Auth users, `role`, boolean `is_active`.
- Allowed lead stages: `new`, `contacted`, `qualified`, `audit_started`, `proposal`, `won`, `lost`.
- All 14 public base tables inspected have RLS enabled. Existing staff policies are organization-wide, not per business.
- Read-only zero-row queries against the exact connector columns succeeded on the live database. These verify schema, not actual customer access or the future connector credential.

`integrations/usha-supabase-context.mjs` implements the concrete REST lookup. It accepts only signed engine context requests and uses a separately provisioned operator mapping `CONTEXT_SCOPES_JSON`:

```json
{"customer-tenant":{"active":true,"businessId":"<existing business UUID>","actorIds":["<individual staff UUID>"]}}
```

Each tenant maps to one business. Membership is checked before any network call. Only active known staff profiles are accepted, and lead reads filter both `id` and `business_id`; returned IDs are checked again. Profile roles never grant a new tenant or engine role. Source stages map to the existing engine enums, unknown stages fail closed, and no contact/message fields are requested. Keep this mapping synchronized with gateway membership and engine principals; revoke all three when access changes.

Provision a dedicated read-only Data API credential for the private connector. `SUPABASE_PUBLISHABLE_KEY` identifies the project; `SUPABASE_CONTEXT_BEARER` supplies the restricted database role. Grant only needed SELECT columns on profiles/leads, with appropriate RLS and no write/function/other-table permissions. Verify that credential against synthetic staging records, including cross-business denial, before use. No such role/token has been provisioned or verified in this session. Do not substitute a production service-role key. Keep private service routes and preview URLs disabled.

## Existing security findings — production release blockers

1. **Profile self-escalation path.** `profiles` has an ALL policy allowing `is_staff() OR id=auth.uid()` for both USING and WITH CHECK. Authenticated users have table UPDATE/INSERT privileges; no authorization-column guard trigger was present. A user with an own profile can therefore potentially change `role`/`is_active`, and `is_staff()` trusts those columns. This was established from policy/grant/constraint definitions; no exploit or customer mutation was attempted. Remediate by removing browser writes to authorization columns, using separate self-profile read/edit policies, and moving role/activation management behind a trusted administrative operation. Test client self-promotion, staff promotion, deactivation/reactivation and ordinary profile edits in staging. Review existing staff-management callers first to preserve their intended workflow.
2. **Public aggregate view bypasses RLS.** `product_signals` has default definer semantics and SELECT grants to anon/authenticated. It aggregates opportunity titles/categories and business counts. Supabase Advisor flags this as ERROR. Change to `security_invoker=true` and/or restrict grants after reviewing its existing consumers; test anonymous denial and authorized dashboard behavior. [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
3. **Mutable function search path.** Advisor flags `set_updated_at`; qualify references and pin its search_path after reviewing its definition. [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
4. **Public privileged RPCs need review.** Advisors flag `is_staff`, `submit_business_audit`, `submit_public_audit`, `submit_roadmap_request`. Public intake is intentional in the existing website, so blanket revocation would break it. Audit validation, scope, rate limiting and privileges before changing these RPCs. [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
5. **Leaked password protection disabled.** Verify account-plan availability and enable through the approved Auth configuration workflow. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The independent ONE AI allowlists limit access through the new connector but do not repair these vulnerabilities in the existing CRM itself. Do not approve production while these findings remain unresolved. Prepare, test and review a separate production security migration; owner authorization to resume the project was not authorization to silently change existing production policies.

## Remaining gates

- Cloudflare staging authorization, separate ONE AI resources and secret provisioning.
- A synthetic Supabase staging environment with tested least-privilege connector credentials.
- Existing CRM security remediation and regression verification before production.
- Real authenticated CRM mounting, remote model tests in three languages, recovery tests and owner production authorization.

Executed: 24 engine/identity/connector tests passed locally, including four new Supabase adapter tests. These use mocked REST responses. No live model or deployed connector test is claimed. CI reruns the full runtime/browser suite on the PR head.
