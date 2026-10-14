import {identifier, requireValue} from './errors.mjs';
export const PRODUCTS = Object.freeze(['usha-one','neo-school-india']);
export const STATES = Object.freeze(['draft','pending_approval','approved','rejected','sent']);
export function validateMessage(message) {
  requireValue(typeof message === 'string' && message.trim().length > 0 && message.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message),400,'Invalid message');
  return message.trim();
}
export function createDraft({tenantId,product,leadId,language='en',message,actorId,now=new Date().toISOString()}) {
  requireValue(PRODUCTS.includes(product),400,'Unknown product');
  requireValue(['en','te','hi'].includes(language),400,'Unsupported language');
  identifier(tenantId,'tenant'); identifier(leadId,'lead'); identifier(actorId,'actor');
  return {id:crypto.randomUUID(),tenantId,product,leadId,language,message:validateMessage(message),state:'draft',createdBy:actorId,
    approvedBy:null,reviewedBy:null,createdAt:now,updatedAt:now,sentAt:null,version:1};
}
export function transition(draft,{action,actorId,role,tenantId,message,now=new Date().toISOString()}) {
  requireValue(draft && STATES.includes(draft.state),400,'Invalid draft');
  requireValue(tenantId===draft.tenantId,403,'Tenant mismatch'); identifier(actorId,'actor');
  requireValue(['staff','manager','admin'].includes(role),403,'Insufficient role');
  if (action==='edit') {
    requireValue(['draft','rejected','approved'].includes(draft.state),409,'Invalid state transition');
    requireValue(actorId===draft.createdBy || role==='admin' || role==='manager',403,'Only the owner or manager can edit');
    return {...draft,message:validateMessage(message),state:'draft',approvedBy:null,reviewedBy:null,updatedAt:now,version:draft.version+1};
  }
  const rules = new Map([['submit',[['draft'],'pending_approval']],['approve',[['pending_approval'],'approved']],['reject',[['pending_approval'],'rejected']]]);
  const rule = rules.get(action);
  requireValue(rule && rule[0].includes(draft.state),409,'Invalid state transition');
  if (action==='submit') requireValue(actorId===draft.createdBy || role==='manager' || role==='admin',403,'Only the owner or manager can submit');
  else requireValue(['manager','admin'].includes(role),403,'Insufficient role');
  if (action==='approve') requireValue(actorId!==draft.createdBy && actorId!==draft.reviewedBy && actorId!==draft.lastEditedBy,403,'Self-approval prohibited');
  return {...draft,state:rule[1],updatedAt:now,version:draft.version+1,
    ...(action==='submit'?{reviewedBy:actorId}:{}),...(action==='approve'?{approvedBy:actorId}:{}),...(action==='reject'?{approvedBy:null}:{})};
}
