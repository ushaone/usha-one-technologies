// SERVER ONLY. The caller must resolve actor from its authenticated session, never JSON.
import {identifier,requireValue,timeout} from '../errors.mjs';
import {signClaims} from '../auth.mjs';
export function createCRMClient({binding,secret,issuer,audience,product}) {
 requireValue(binding?.fetch && ['usha-one','neo-school-india'].includes(product) && issuer && audience,503,'ONE AI integration not configured');
 return async function oneAI(actor,path,{method='GET',body,idempotencyKey}={}) {
  identifier(actor.tenantId);identifier(actor.actorId);
  requireValue(Number.isSafeInteger(actor.authVersion)&&actor.authVersion>0,403,'Individual authenticated identity required');
  const url=new URL(path,'https://one-ai.internal');
  requireValue(url.origin==='https://one-ai.internal' && /^\/api\/drafts(?:\/generate|\/[A-Za-z0-9-]+(?:\/(?:events|transition))?)?$/.test(url.pathname),400,'Unsupported ONE AI route');
  requireValue(['GET','POST'].includes(method),405,'Method not allowed');
  const now=Math.floor(Date.now()/1000);
  const token=await signClaims({iss:issuer,aud:audience,product,tenantId:actor.tenantId,sub:actor.actorId,version:actor.authVersion,jti:crypto.randomUUID(),iat:now,exp:now+120},secret);
  const headers={authorization:'Bearer '+token};
  if(body!==undefined)headers['content-type']='application/json';
  if(idempotencyKey)headers['idempotency-key']=identifier(idempotencyKey);
  return timeout(binding.fetch(new Request(url,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})})),20000);
 };
}
