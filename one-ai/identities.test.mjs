import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveIdentity} from './integrations/identities.mjs';
import gateway from './integrations/gateway-worker.mjs';
import {verifyClaims} from './auth.mjs';
const request=()=>new Request('https://crm.test/api/one-ai/drafts',{headers:{authorization:'Bearer existing.session.token'}});
const membership={active:true,tenantId:'tenant-a',authVersion:1,schoolId:'S1'};
test('USHA reuses verified Supabase user and ignores user-controlled metadata/role',async()=>{
 const env={PRODUCT:'usha-one',SUPABASE_ORIGIN:'https://staging-project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-publishable-key',SESSION_MEMBERSHIPS_JSON:JSON.stringify({'user-1':membership})};
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,env.SUPABASE_ORIGIN+'/auth/v1/user');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer existing.session.token');return Response.json({id:'user-1',user_metadata:{role:'super_admin',tenantId:'attacker'}});};
 assert.deepEqual(await resolveIdentity(request(),env,fetcher),{actorId:'user-1',tenantId:'tenant-a',authVersion:1});
 await assert.rejects(()=>resolveIdentity(request(),{...env,SUPABASE_ORIGIN:'http://127.0.0.1'},fetcher));assert.equal(calls,1);
 await assert.rejects(()=>resolveIdentity(request(),env,async()=>Response.json({id:'user-2'})),e=>e.status===403);
 await assert.rejects(()=>resolveIdentity(request(),env,async()=>Response.json({id:'user-1',is_anonymous:true})),e=>e.status===401);
 await assert.rejects(()=>resolveIdentity(request(),env,async()=>Response.json({error:'invalid'},{status:401})),e=>e.status===401);
});
test('Neo requires individual account, current school identity and provisioned membership',async()=>{
 const env={PRODUCT:'neo-school-india',SESSION_MEMBERSHIPS_JSON:JSON.stringify({'NT-STAFF-1':membership}),NEO_APP:{async fetch(r){assert.equal(new URL(r.url).pathname,'/api/employee/me');return Response.json({account_id:'NT-STAFF-1',school_id:'S1',payroll:[{private:'never forward'}]});}}};
 assert.deepEqual(await resolveIdentity(request(),env),{actorId:'NT-STAFF-1',tenantId:'tenant-a',authVersion:1});
 for(const body of [{account_id:'NT-STAFF-1'},{account_id:'NT-STAFF-1',school_id:'OTHER'},{role:'admin',school_id:'S1'}])await assert.rejects(()=>resolveIdentity(request(),{...env,NEO_APP:{fetch:async()=>Response.json(body)}}));
 await assert.rejects(()=>resolveIdentity(new Request('https://crm.test'),env),e=>e.status===401);
});
test('gateway replaces source session with scoped engine identity and rejects cross-origin/send requests',async()=>{
 let forwarded=0;const secret='gateway-test-secret-'.repeat(3);
 const env={PRODUCT:'neo-school-india',CRM_ORIGIN:'https://crm.test',TOKEN_ISSUER:'neo-crm-staging',TOKEN_AUDIENCE:'neo-engine',ONE_AI_TOKEN_SECRET:secret,
 SESSION_MEMBERSHIPS_JSON:JSON.stringify({'NT-STAFF-1':membership}),NEO_APP:{fetch:async()=>Response.json({account_id:'NT-STAFF-1',school_id:'S1',payroll:['PRIVATE']})},
 ONE_AI:{async fetch(r){forwarded++;const c=await verifyClaims(r.headers.get('authorization').slice(7),secret,{issuer:'neo-crm-staging',audience:'neo-engine',product:'neo-school-india'});assert.equal(c.sub,'NT-STAFF-1');assert.equal(c.tenantId,'tenant-a');assert.equal(new URL(r.url).pathname,'/api/drafts');return Response.json({drafts:[]});}}};
 assert.equal((await gateway.fetch(request(),env)).status,200);
 const foreign=new Request(request(),{headers:{authorization:'Bearer existing.session.token',origin:'https://attacker.test'}});assert.equal((await gateway.fetch(foreign,env)).status,403);
 const send=new Request('https://crm.test/api/one-ai/drafts/a/send',{method:'POST',headers:{authorization:'Bearer existing.session.token'}});assert.equal((await gateway.fetch(send,env)).status,404);assert.equal(forwarded,1);
 env.NEO_APP.fetch=async()=>Response.json({error:'revoked'},{status:401});assert.equal((await gateway.fetch(request(),env)).status,401);assert.equal(forwarded,1);
});
