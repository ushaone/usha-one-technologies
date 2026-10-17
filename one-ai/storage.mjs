import {requireValue} from './errors.mjs';
function shape(r) {
  return r ? {id:r.id,tenantId:r.tenant_id,product:r.product,leadId:r.lead_id,language:r.language,message:r.message,state:r.state,
    createdBy:r.created_by,approvedBy:r.approved_by,reviewedBy:r.reviewed_by,lastEditedBy:r.last_edited_by,createdAt:r.created_at,
    updatedAt:r.updated_at,sentAt:r.sent_at,version:r.version,source:r.source}:null;
}
export async function getDraft(db,tenantId,id) {
  return shape(await db.prepare('SELECT * FROM one_ai_drafts WHERE tenant_id=? AND id=?').bind(tenantId,id).first());
}
export async function findRequest(db,actor,key,hash) {
  const row = await db.prepare('SELECT * FROM one_ai_drafts WHERE tenant_id=? AND created_by=? AND request_key=?').bind(actor.tenantId,actor.actorId,key).first();
  if (row) requireValue(row.request_hash===hash,409,'Idempotency key reused with different input');
  return shape(row);
}
export async function insertDraft(db,draft,{requestKey,requestHash,source='manual'}) {
  // The audit trigger runs in the SAME SQLite statement/transaction and rolls back on failure.
  await db.prepare(`INSERT INTO one_ai_drafts (id,tenant_id,product,lead_id,language,message,state,created_by,approved_by,created_at,updated_at,sent_at,version,
    last_actor,last_action,request_key,request_hash,source,last_edited_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(tenant_id,created_by,request_key) WHERE request_key IS NOT NULL DO NOTHING`)
    .bind(draft.id,draft.tenantId,draft.product,draft.leadId,draft.language,draft.message,draft.state,draft.createdBy,null,draft.createdAt,draft.updatedAt,null,1,
      draft.createdBy,'create',requestKey,requestHash,source,draft.createdBy).run();
  return findRequest(db,{tenantId:draft.tenantId,actorId:draft.createdBy},requestKey,requestHash);
}
export async function saveTransition(db,before,after,action,actorId) {
  const row = await db.prepare(`UPDATE one_ai_drafts SET message=?,state=?,approved_by=?,reviewed_by=?,updated_at=?,version=?,last_actor=?,last_action=?,
    last_edited_by=CASE WHEN ?='edit' THEN ? ELSE last_edited_by END WHERE id=? AND tenant_id=? AND version=? AND state=? RETURNING *`)
    .bind(after.message,after.state,after.approvedBy,after.reviewedBy,after.updatedAt,after.version,actorId,action,action,actorId,
      before.id,before.tenantId,before.version,before.state).first();
  requireValue(row,409,'Concurrent modification');
  return shape(row);
}
export async function listDrafts(db,tenantId,{state=null,leadId=null,before=null}={}) {
  const result = await db.prepare(`SELECT * FROM one_ai_drafts WHERE tenant_id=? AND (? IS NULL OR state=?) AND (? IS NULL OR lead_id=?)
    AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 51`).bind(tenantId,state,state,leadId,leadId,before,before).all();
  const more=result.results.length>50; const rows=result.results.slice(0,50);
  return {drafts:rows.map(shape),nextCursor:more?rows.at(-1).id:null};
}
export async function auditEvents(db,tenantId,id) {
  return (await db.prepare('SELECT actor_id AS actorId,action,at,version FROM one_ai_events WHERE tenant_id=? AND draft_id=? ORDER BY version,at LIMIT 500')
    .bind(tenantId,id).all()).results;
}
export async function hashInput(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))), x=>x.toString(16).padStart(2,'0')).join('');
}
