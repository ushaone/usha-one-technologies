/**
 * ONE AI Master — pure workflow contract (no network, database, or model calls).
 * Import into an authenticated server-side adapter; never trust tenantId from a browser.
 */
export const PRODUCTS = Object.freeze(["usha-one", "neo-school-india"]);
export const STATES = Object.freeze(["draft", "pending_approval", "approved", "rejected", "sent"]);
const max = (value, length) => String(value ?? "").trim().slice(0, length);
function assert(condition, message) { if (!condition) throw new Error(message); }
export function createDraft({ tenantId, product, leadId, language = "en", message, actorId, now = new Date().toISOString() }) {
  assert(PRODUCTS.includes(product), "Unknown product");
  assert(["en", "te", "hi"].includes(language), "Unsupported language");
  assert(typeof tenantId === "string" && tenantId.trim().length > 0, "Tenant required");
  assert(typeof leadId === "string" && leadId.trim().length > 0, "Lead required");
  assert(typeof actorId === "string" && actorId.trim().length > 0, "Actor required");
  assert(typeof message === "string" && message.trim().length > 0 && message.length <= 4000, "Invalid message");
  return {
    id: crypto.randomUUID(), tenantId: max(tenantId, 128), product,
    leadId: max(leadId, 128), language, message: message.trim(),
    state: "draft", createdBy: max(actorId, 128), approvedBy: null,
    createdAt: now, updatedAt: now, sentAt: null, version: 1
  };
}
/**
 * Enforce authenticated tenant and actor in the server adapter BEFORE invoking.
 * Authorization roles are asserted here as defense in depth.
 */
export function transition(draft, { action, actorId, role, tenantId, now = new Date().toISOString() }) {
  assert(draft && STATES.includes(draft.state), "Invalid draft");
  assert(tenantId === draft.tenantId, "Tenant mismatch");
  assert(actorId && typeof actorId === "string", "Actor required");
  const allowed = {
    submit: ["draft", "pending_approval", ["staff", "manager", "admin"]],
    approve: ["pending_approval", "approved", ["manager", "admin"]],
    reject: ["pending_approval", "rejected", ["manager", "admin"]],
    mark_sent: ["approved", "sent", ["sender", "manager", "admin"]]
  };
  const rule = allowed[action];
  assert(rule && draft.state === rule[0], "Invalid state transition");
  assert(rule[2].includes(role), "Insufficient role");
  assert(action !== "approve" || actorId !== draft.createdBy, "Self-approval prohibited");
  return {
    ...draft, state: rule[1], updatedAt: now, version: draft.version + 1,
    ...(action === "approve" ? { approvedBy: actorId } : {}),
    ...(action === "mark_sent" ? { sentAt: now } : {})
  };
}
