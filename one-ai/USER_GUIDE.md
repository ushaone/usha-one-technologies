# Staff and manager guide

ONE AI helps prepare follow-up text. It does not send messages, promise admissions, set fees or update the existing customer record.

## Staff

1. Sign in to your own CRM account and open the correct customer/admission enquiry.
2. Open the ONE AI panel. Choose English, తెలుగు or हिन्दी and select **Generate draft**.
3. Read every sentence. Check language, tone and factual accuracy. Never add student documents, bank data, passwords or other sensitive information.
4. Edit the text if needed, then select **Save revision**. The saved status remains Draft.
5. Select **Submit for approval**. A manager can now review the exact saved version.
6. If the manager rejects it, save a revision and submit again. If another person changed it, use Reload drafts after the version-conflict message.

## Managers

Use your own manager account. Read the selected pending draft and choose Approve or Reject. You cannot approve a draft you created, last edited or submitted for review; another manager must approve it. Editing an approved draft removes that approval and starts review again.

Approval does not send WhatsApp, SMS or email. Sending remains disabled while consent, provider and template setup are pending. Do not interpret the Approved status as a delivered message.

## తెలుగు సూచనలు

- మీ వ్యక్తిగత CRM లాగిన్‌తో సరైన ఎంక్వైరీని తెరవండి.
- భాష ఎంచుకుని **Generate draft** నొక్కండి. వచ్చిన మెసేజ్‌ను పూర్తిగా చదివి వివరాలు సరిగా ఉన్నాయో చూడండి.
- మార్పులు చేస్తే **Save revision**, తర్వాత **Submit for approval** నొక్కండి.
- వేరే మేనేజర్ తన లాగిన్‌తో **Approve** లేదా **Reject** చేయాలి. మీరు తయారుచేసిన లేదా సమీక్షకు పంపిన డ్రాఫ్ట్‌ను మీరే అప్రూవ్ చేయలేరు.
- **Approved అంటే కస్టమర్‌కు మెసేజ్ పంపినట్లు కాదు.** ప్రస్తుతం మెసేజ్ పంపడం నిలిపి ఉంచాం.

## Errors

- Unauthorized: session expired, membership revoked or provisioning mismatch; sign in again or contact the administrator.
- Forbidden / Insufficient role: this action requires the correct staff/manager permission.
- Self-approval prohibited: ask a different manager to review.
- Concurrent modification: reload the saved draft before acting; do not approve an old copy.
- Lead not found: wrong customer/branch or an unavailable enquiry; check the CRM selection.
- Rate limit exceeded: wait a minute; do not repeatedly regenerate.
- AI/CRM integration not configured or provider timeout: ask the administrator to check staging/provider setup. A timeout does not prove the provider performed no work; creation retries should reuse the same idempotency key.
