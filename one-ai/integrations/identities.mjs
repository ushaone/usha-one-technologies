// Reuse existing identity providers. Never decode an unverified session or trust user_metadata roles.
import {identifier,requireValue,readJSON,timeout} from '../errors.mjs';
export function bearer(request) {
 const auth=request.headers.get('authorization')||'';
 requireValue(/^Bearer [A-Za-z0-9_.-]+$/.test(auth) && auth.length<=8192,401,'Individual staff sign-in required');
 return auth;
}
function membership(env,subject,schoolId) {
 identifier(subject,'staff identity');
 let entries;try{entries=JSON.parse(env.SESSION_MEMBERSHIPS_JSON||'{}');}catch{requireValue(false,503,'Membership mapping not configured');}
 requireValue(entries && typeof entries==='object' && Object.hasOwn(entries,subject),403,'Staff account is not provisioned for ONE AI');
 const entry=entries[subject];requireValue(entry?.active===true,403,'Staff account is not provisioned for ONE AI');
 identifier(entry.tenantId,'tenant');
 requireValue(Number.isSafeInteger(entry.authVersion)&&entry.authVersion>0,503,'Membership version not configured');
 if(env.PRODUCT==='neo-school-india')requireValue(typeof schoolId==='string' && schoolId===entry.schoolId,403,'School identity mismatch; verify deployed employee API');
 return {actorId:subject,tenantId:entry.tenantId,authVersion:entry.authVersion};
}
export async function resolveIdentity(request,env,fetcher=fetch) {
 const authorization=bearer(request);
 if(env.PRODUCT==='usha-one') {
  requireValue(typeof env.SUPABASE_ORIGIN==='string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_ORIGIN) && typeof env.SUPABASE_PUBLISHABLE_KEY==='string' && env.SUPABASE_PUBLISHABLE_KEY.length>0,503,'Supabase identity not configured');
  const response=await fetcher(env.SUPABASE_ORIGIN+'/auth/v1/user',{headers:{authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY},redirect:'error',signal:AbortSignal.timeout(5000)});
  requireValue(response.status!==401 && response.status!==403,401,'Individual staff sign-in required');
  requireValue(response.ok,502,'Identity provider unavailable');
  const user=await timeout(readJSON(response,65536),5000);
  requireValue(user && typeof user.id==='string' && user.is_anonymous!==true,401,'Individual staff sign-in required');
  return membership(env,user.id);
 }
 if(env.PRODUCT==='neo-school-india') {
  requireValue(env.NEO_APP?.fetch,503,'Neo identity integration not configured');
  // This fixed read validates account activity/password version in Neo. No root login key is shared.
  const response=await timeout(env.NEO_APP.fetch(new Request('https://neo.internal/api/employee/me',{headers:{authorization}})),5000);
  requireValue(response.status!==401 && response.status!==403,401,'Individual employee sign-in required');
  requireValue(response.ok,502,'Identity provider unavailable');
  // Existing endpoint includes HR details. Discard them here; never return/log/forward them.
  const employee=await timeout(readJSON(response,262144),5000);
  requireValue(employee && typeof employee.account_id==='string',401,'Individual employee sign-in required');
  return membership(env,employee.account_id,employee.school_id);
 }
 requireValue(false,503,'Unknown identity provider');
}
