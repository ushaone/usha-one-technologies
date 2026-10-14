# ONE AI Master — Foundation (not deployed)

This development branch is separate from the live website and the SEO release branches.

## Shared workflow
Lead reference → AI-generated message candidate (future model adapter) → staff review → manager approval → approved outbound adapter → delivery tracking.

The current `one-ai/workflow.mjs` implements **only** a pure draft/state-transition contract. It does not call a model, send WhatsApp, persist data, authenticate users, or deploy a Worker.

## Product adapters
- `usha-one`: business leads and customer follow-ups; CRM backend must be located/confirmed before integration.
- `neo-school-india`: existing admission enquiry and lead CRM remain the system of record; integrate only through authenticated APIs after verifying deployed backend versions.

## Security gates before live use
1. Authenticate server-side; derive tenant and actor identity from verified credentials, never request JSON.
2. Persist tenant-scoped drafts and append-only audit events with optimistic version checks.
3. Keep Neo parent/student information isolated from USHA customer information.
4. Require a distinct approver and explicit human action before outbound messages.
5. Add rate limits, data minimization, secrets management, provider timeouts, and retry/idempotency controls.
6. Test Telugu/English copy, permissions, cross-tenant denial, and approval race conditions.
7. Integrate WhatsApp only after consent/template/provider rules are confirmed.

## Current status
Foundation contract committed for review; no production change.
