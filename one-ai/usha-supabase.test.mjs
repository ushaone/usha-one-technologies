import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseLeadLookup} from './integrations/usha-supabase-context.mjs';
import worker from './integrations/usha-supabase-context.mjs';
const actor='11111111-1111-4111-8111-111111111111',lead='22222222-2222-4222-8222-222222222222',business='33333333-3333-4333-8333-333333333333';
const env={SUPABASE_ORIGIN:'https://staging-project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-publishable',SUPABASE_CONTEXT_BEARER:'test-only-scoped-credential-'.repeat(2),CONTEXT_SCOPES_JSON:JSON.stringify({'tenant-a':{active:true,businessId:business,actorIds:[actor]}})};
const input={tenantId:'tenant-a',leadId:lead,actorId:actor};
const profile={id:actor,role:'consultant',is_active:true};
function responseFetcher(leadResult,profileResult=profile){return async url=>Response.json(url.pathname.endsWith('/profiles')?(profileResult?[profileResult]:[]):leadResult?[leadResult]:[]);}
test('USHA verified schema lookup uses exact scope, minimized columns and known status mapping',async()=>{
 for(const [status,expected] of [['new','New'],['contacted','Contacted'],['qualified','Interested'],['audit_started','Follow-up'],['proposal','Decision Pending'],['won','Converted'],['lost','Lost']]){
  const calls=[];const lookup=createSupabaseLeadLookup(env,async(url,options)=>{
   calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer '+env.SUPABASE_CONTEXT_BEARER);
   assert.equal(url.searchParams.get('limit'),'1');
   if(url.pathname.endsWith('/profiles')){assert.equal(url.searchParams.get('select'),'id,role,is_active');assert.equal(url.searchParams.get('id'),'eq.'+actor);return Response.json([profile]);}
   assert.equal(url.searchParams.get('select'),'id,business_id,status');assert.equal(url.searchParams.get('id'),'eq.'+lead);assert.equal(url.searchParams.get('business_id'),'eq.'+business);
   return Response.json([{id:lead,business_id:business,status,message:'PRIVATE',phone:'PRIVATE'}]);
  });
  assert.deepEqual(await lookup(input),{tenantId:'tenant-a',leadId:lead,status:expected});assert.equal(calls.length,2);
 }
});
test('USHA context denies other tenants/actors before querying and rejects wrong returned business',async()=>{
 let calls=0;const lookup=createSupabaseLeadLookup(env,async()=>{calls++;throw Error('Must not query');});
 assert.equal(await lookup({...input,tenantId:'other'}),null);
 assert.equal(await lookup({...input,actorId:business}),null);assert.equal(calls,0);
 for(const row of [null,{id:lead,business_id:actor,status:'new'},{id:business,business_id:business,status:'new'},{id:lead,business_id:null,status:'new'}])assert.equal(await createSupabaseLeadLookup(env,responseFetcher(row))(input),null);
});
test('USHA context fails closed for inactive/client accounts, unknown stages and upstream errors',async()=>{
 for(const p of [null,{...profile,is_active:false},{...profile,role:'client_owner'},{...profile,id:business}])assert.equal(await createSupabaseLeadLookup(env,responseFetcher({id:lead,business_id:business,status:'new'},p))(input),null);
 await assert.rejects(()=>createSupabaseLeadLookup(env,responseFetcher({id:lead,business_id:business,status:'unknown'}))(input));
 await assert.rejects(()=>createSupabaseLeadLookup(env,async()=>Response.json({error:'denied'},{status:403}))(input));
 await assert.rejects(()=>createSupabaseLeadLookup(env,async()=>Response.json([profile,profile]))(input));
 await assert.rejects(()=>createSupabaseLeadLookup({...env,SUPABASE_ORIGIN:'http://127.0.0.1'},async()=>{throw Error('No call');})(input));
});
test('private Supabase service rejects unsigned calls before database access',async()=>{
 assert.equal((await worker.fetch(new Request('https://internal/context/'+lead),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://internal/context/'+lead,{method:'POST'}),env)).status,404);
});
