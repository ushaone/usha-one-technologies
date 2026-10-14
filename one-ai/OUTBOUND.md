# Outbound messaging gate

Sending is deliberately disabled at the engine API and absent from the CRM client. An approved draft does not send a message or mark it sent. Manual `mark_sent` is rejected. Health/readiness report outbound as disabled.

The current repositories do not establish a verified consent registry, provider account, sender, templates or delivery-webhook configuration. Implementing a generic HTTP sender against guessed configuration would be unsafe.

Before adding a provider-specific sender, require all of:

- Current, revocable recipient consent for the exact organization, channel and purpose, obtained from that organization's CRM at dispatch time. A browser checkbox on a draft is not proof.
- A provider-approved template ID/version/language, with variables constrained to the approved content. Human approval of a free-form draft is not provider template approval.
- Tenant-specific verified provider credentials and sender; never a request-supplied endpoint, API key, phone or recipient.
- A transactionally claimed outbox row bound to the approved draft version, content digest and recipient reference; unique dispatch key; no automatic retry after an uncertain provider response without provider idempotency/reconciliation.
- Verified signed delivery webhooks, replay protection, separate accepted/delivered/failed states, rate limits and a kill switch.
- Tests for opt-out after approval, tenant mismatch, expired/rejected templates, duplicate dispatch, provider timeout, webhook forgery and edited content.

Then complete a synthetic staging send with a consenting test recipient and obtain the release owner's production authorization. Nothing in this branch contacts real recipients.
