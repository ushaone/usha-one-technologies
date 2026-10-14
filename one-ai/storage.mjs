// D1 storage contract: bind DB to an authenticated Cloudflare Worker.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS one_ai_drafts (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, product TEXT NOT NULL,
 lead_id TEXT NOT NULL, language TEXT NOT NULL, message TEXT NOT NULL,
 state TEXT NOT NULL, created_by TEXT NOT NULL, approved_by TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sent_at TEXT,
 version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS one_ai_drafts_tenant_lead ON one_ai_drafts(tenant_id, lead_id);
CREATE TABLE IF NOT EXISTS one_ai_events (
 id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL,
 FOREIGN KEY (draft_id) REFERENCES one_ai_drafts(id)
);
`;
export async function insertDraft(db, draft) {
 await db.prepare("INSERT INTO one_ai_drafts (id,tenant_id,product,lead_id,language,message,state,created_by,approved_by,created_at,updated_at,sent_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
 .bind(draft.id,draft.tenantId,draft.product,draft.leadId,draft.language,draft.message,draft.state,draft.createdBy,draft.approvedBy,draft.createdAt,draft.updatedAt,draft.sentAt,draft.version).run();
 return draft;
}
export async function getDraft(db, tenantId, id) {
 const row=await db.prepare("SELECT * FROM one_ai_drafts WHERE tenant_id=? AND id=?").bind(tenantId,id).first();
 return row ? {id:row.id,tenantId:row.tenant_id,product:row.product,leadId:row.lead_id,language:row.language,message:row.message,state:row.state,createdBy:row.created_by,approvedBy:row.approved_by,createdAt:row.created_at,updatedAt:row.updated_at,sentAt:row.sent_at,version:row.version}:null;
}
export async function saveTransition(db, before, after, action, actorId) {
 // Atomic optimistic concurrency update; event written only after successful update.
 // TODO: use D1 batch/transaction boundary for strict event atomicity.
 const result=await db.prepare("UPDATE one_ai_drafts SET state=?,approved_by=?,updated_at=?,sent_at=?,version=? WHERE id=? AND tenant_id=? AND version=? AND state=?")
 .bind(after.state,after.approvedBy,after.updatedAt,after.sentAt,after.version,before.id,before.tenantId,before.version,before.state).run();
 if(result.meta?.changes!==1) throw new Error("Concurrent modification");
 await db.prepare("INSERT INTO one_ai_events (id,draft_id,tenant_id,actor_id,action,at) VALUES (?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),before.id,before.tenantId,actorId,action,after.updatedAt).run();
 return after;
}
