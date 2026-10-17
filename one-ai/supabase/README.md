# Existing USHA security migration candidate

`migrations/20261014125351_harden_existing_usha_profiles_and_view.sql` was created with Supabase CLI 2.120.0 and tested against a synthetic PostgreSQL fixture (PGlite 0.5.9). It has **not** been applied to the existing Supabase project. CI runs the tests only; it never connects to or changes Supabase.

## Concrete effect

- Revoke browser profile INSERT/DELETE and authorization-column writes, including old column-level grants. Keep authenticated SELECT and UPDATE(full_name,email,phone), subject to existing RLS. Profile email is display metadata, not an Auth email change.
- Protect the aggregate product_signals view with security_invoker and remove anonymous/PUBLIC grants. Active staff retains access under the existing opportunities RLS; client sessions see no rows.
- Pin set_updated_at search_path to pg_catalog. Its inspected body uses only NEW.updated_at and now().
- Wrap all changes in one transaction, use bounded lock/statement timeouts, and abort if inherited profile write privileges defeat the boundary.

## Compatibility and release gates

**Browser-based staff creation/deletion, role assignment and activation changes will stop working.** Route these operations through a trusted administrative backend with explicit operator authorization/audit before production. The current repository does not contain their callers; their deployed behavior has not been tested. Existing privileged server-side signup/provisioning needs a staging regression check as well.

The migration deliberately retains the existing RLS scope for harmless profile edits (own profile or active staff). It does not establish tenant isolation across all legacy CRM tables, audit all public intake RPCs, enable leaked-password protection or provision the ONE AI connector role. Those are separate outstanding release tasks.

Before applying:

1. Capture current policy/grant/view/function definitions and a recoverable project backup; verify the intended existing project ID.
2. Apply to an approved synthetic Supabase staging copy, not the operational project. Verify Auth signup, staff provisioning, safe profile edits, revocation, dashboards and existing public intake forms.
3. Verify the least-privilege context credential and tenant/business/staff mappings separately.
4. Run Supabase security advisors; investigate remaining findings. Review actual application consumers and obtain owner authorization for the concrete production change.

The tests reproduce the old escalation and view exposure using synthetic records, then check denied promotion/reactivation/identity change/profile replacement, allowed safe edits, cross-profile denial, staff/client/anonymous view behavior, deactivated staff and all-or-nothing rollback when unexpected inherited grants exist. `npm test` runs these with the engine suite (28 tests total).

## Recovery

If a statement fails before COMMIT, rollback keeps the previous configuration. If application issues appear after a successful apply, prefer a forward fix to the trusted provisioning backend or disable the affected feature. Do not restore the old broad profile grants or public definer-view exposure as a routine rollback. A reviewed recovery using the captured pre-change definitions requires explicit incident authorization. No automatic destructive or security-weakening rollback is shipped.
