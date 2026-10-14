import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,transition} from './workflow.mjs';
const create=()=>createDraft({tenantId:'neo-jagtial',product:'neo-school-india',leadId:'L1',language:'te',message:'నమస్కారం',actorId:'staff-1'});
test('draft requires valid product and nonempty message',()=>{
 assert.throws(()=>createDraft({tenantId:'x',product:'other',leadId:'L',message:'hi',actorId:'u'}));
 assert.throws(()=>createDraft({tenantId:'x',product:'usha-one',leadId:'L',message:' ',actorId:'u'}));
});
test('review and approval are explicit and tenant scoped',()=>{
 const d=create();const pending=transition(d,{action:'submit',actorId:'staff-1',role:'staff',tenantId:d.tenantId});
 assert.equal(pending.state,'pending_approval');
 assert.throws(()=>transition(pending,{action:'approve',actorId:'staff-1',role:'admin',tenantId:d.tenantId}));
 assert.throws(()=>transition(pending,{action:'approve',actorId:'admin-2',role:'admin',tenantId:'usha-customer'}));
 const approved=transition(pending,{action:'approve',actorId:'admin-2',role:'admin',tenantId:d.tenantId});
 assert.equal(approved.approvedBy,'admin-2');
 assert.throws(()=>transition(approved,{action:'submit',actorId:'staff-1',role:'staff',tenantId:d.tenantId}));
 const sent=transition(approved,{action:'mark_sent',actorId:'sender-1',role:'sender',tenantId:d.tenantId});
 assert.equal(sent.state,'sent');
});
test('unprivileged actors cannot approve or mark sent',()=>{
 const d=create();const pending=transition(d,{action:'submit',actorId:'staff-1',role:'staff',tenantId:d.tenantId});
 assert.throws(()=>transition(pending,{action:'approve',actorId:'other',role:'staff',tenantId:d.tenantId}));
 assert.throws(()=>transition(pending,{action:'mark_sent',actorId:'other',role:'sender',tenantId:d.tenantId}));
});
