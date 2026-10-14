import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,transition} from './workflow.mjs';
const create=()=>createDraft({tenantId:'neo-jagtial',product:'neo-school-india',leadId:'L1',language:'te',message:'నమస్కారం',actorId:'staff-1'});
test('reject unknown products, empty text and identifiers without truncating',()=>{
 for(const patch of [{product:'other'},{message:' '},{tenantId:'x'.repeat(129)},{actorId:5},{leadId:' L'}])assert.throws(()=>createDraft({...create(),actorId:'s',...patch}));
});
test('review then distinct manager approval; edit invalidates approval',()=>{
 const d=create(), pending=transition(d,{action:'submit',actorId:'staff-1',role:'staff',tenantId:d.tenantId});
 assert.throws(()=>transition(pending,{action:'approve',actorId:'staff-1',role:'admin',tenantId:d.tenantId}));
 assert.throws(()=>transition(pending,{action:'approve',actorId:'manager',role:'manager',tenantId:'other'}));
 assert.throws(()=>transition(pending,{action:'approve',actorId:'other',role:'staff',tenantId:d.tenantId}));
 const approved=transition(pending,{action:'approve',actorId:'manager',role:'manager',tenantId:d.tenantId});
 const edit=transition(approved,{action:'edit',actorId:'staff-1',role:'staff',tenantId:d.tenantId,message:'Updated'});
 assert.equal(edit.state,'draft'); assert.equal(edit.approvedBy,null);assert.equal(edit.reviewedBy,null);
 assert.throws(()=>transition(approved,{action:'mark_sent',actorId:'manager',role:'manager',tenantId:d.tenantId}));
});
test('manager who submits another author draft cannot approve',()=>{
 const d=create(), pending=transition(d,{action:'submit',actorId:'manager',role:'manager',tenantId:d.tenantId});
 assert.throws(()=>transition(pending,{action:'approve',actorId:'manager',role:'manager',tenantId:d.tenantId}));
});

test('prototype property names are rejected as unknown transitions',()=>{
 for(const action of ['__proto__','constructor','toString'])assert.throws(()=>transition(create(),{tenantId:'neo-jagtial',actorId:'staff-1',role:'staff',action}),e=>e.status===409);
});
