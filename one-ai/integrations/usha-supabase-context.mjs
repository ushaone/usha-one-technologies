// Private service only. Schema verified read-only against existing USHA on 2026-10-14.
import {createUshaContextService} from './usha-context.mjs';
import {requireValue,readJSON,timeout} from '../errors.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages=new Map([['new','New'],['contacted','Contacted'],['qualified','Interested'],['audit_started','Follow-up'],['proposal','Decision Pending'],['won','Converted'],['lost','Lost']]);
const staff=new Set(['super_admin','admin','consultant','developer','support']);
export function createSupabaseLeadLookup(env,fetcher=fetch) {
 return async ({tenantId,leadId,actorId})=>{
  requireValue(uuid.test(leadId)&&uuid.test(actorId),400,'Invalid CRM identifier');
  // Independent server-owned membership; existing profiles RLS is too broad to supply tenant scope.
  const scopes=JSON.parse(env.CONTEXT_SCOPES_JSON||'{}');
  if(!Object.hasOwn(scopes,tenantId))return null;
  const scope=scopes[tenantId];
  if(scope?.active!==true || !Array.isArray(scope.actorIds) || !scope.actorIds.includes(actorId))return null;
  requireValue(typeof scope.businessId==='string'&&uuid.test(scope.businessId),503,'Business scope not configured');
  requireValue(typeof env.SUPABASE_ORIGIN==='string'&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_ORIGIN),503,'CRM origin not configured');
  requireValue(typeof env.SUPABASE_PUBLISHABLE_KEY==='string'&&env.SUPABASE_PUBLISHABLE_KEY.length>0&&typeof env.SUPABASE_CONTEXT_BEARER==='string'&&env.SUPABASE_CONTEXT_BEARER.length>=32,503,'Read-only CRM credential not configured');
  async function one(table,params) {
   const url=new URL('/rest/v1/'+table,env.SUPABASE_ORIGIN);
   for(const [key,value] of Object.entries({...params,limit:'1'}))url.searchParams.set(key,value);
   const response=await fetcher(url,{method:'GET',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,authorization:'Bearer '+env.SUPABASE_CONTEXT_BEARER,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(4000)});
   requireValue(response.ok,502,'CRM read unavailable');
   const rows=await timeout(readJSON(response,4096,{allowArray:true}),4000);
   requireValue(Array.isArray(rows)&&rows.length<=1,502,'Invalid CRM result');
   return rows[0]??null;
  }
  const profile=await one('profiles',{select:'id,role,is_active',id:'eq.'+actorId,is_active:'eq.true'});
  if(!profile||profile.id!==actorId||profile.is_active!==true||!staff.has(profile.role))return null;
  const lead=await one('leads',{select:'id,business_id,status',id:'eq.'+leadId,business_id:'eq.'+scope.businessId});
  if(!lead||lead.id!==leadId||lead.business_id!==scope.businessId)return null;
  requireValue(stages.has(lead.status),502,'Unsupported CRM stage');
  return {tenantId,leadId,status:stages.get(lead.status)};
 };
}
export default {async fetch(request,env) {
 return createUshaContextService({findLead:createSupabaseLeadLookup(env)}).fetch(request,env);
}};
