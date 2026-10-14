import {APIError, identifier, requireValue} from './errors.mjs';
const encode = value => btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode = value => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), x=>x.charCodeAt(0));
const utf8 = new TextEncoder();
export async function signClaims(claims, secret) {
  requireValue(typeof secret === 'string' && secret.length >= 32, 503, 'Signing key not configured');
  const payload = encode(utf8.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,utf8.encode(payload))))}`;
}
export async function verifyClaims(token, secret, {issuer, audience, product}, now = Math.floor(Date.now()/1000)) {
  try {
    if (typeof secret !== 'string' || secret.length < 32 || typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || parts.some(x=>!x || !/^[A-Za-z0-9_-]+$/.test(x)) || parts[1].length !== 43) return null;
    const key = await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    if (!await crypto.subtle.verify('HMAC',key,decode(parts[1]),utf8.encode(parts[0]))) return null;
    const c = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));
    if (c.iss !== issuer || c.aud !== audience || c.product !== product || !issuer || !audience || !product) return null;
    if (!Number.isSafeInteger(c.iat) || !Number.isSafeInteger(c.exp) || c.iat > now + 30 || c.exp <= now || c.exp - c.iat > 300 || c.exp <= c.iat) return null;
    identifier(c.tenantId); identifier(c.sub); identifier(c.jti);
    if (!Number.isSafeInteger(c.version) || c.version < 1) return null;
    return c;
  } catch { return null; }
}
export async function authenticate(request, env) {
  const raw = request.headers.get('authorization') || '';
  const claims = await verifyClaims(raw.startsWith('Bearer ') ? raw.slice(7) : '', env.ONE_AI_TOKEN_SECRET,
    {issuer:env.TOKEN_ISSUER,audience:env.TOKEN_AUDIENCE,product:env.PRODUCT});
  requireValue(claims, 401, 'Unauthorized');
  const row = await env.DB.prepare('SELECT role,auth_version FROM one_ai_principals WHERE tenant_id=? AND actor_id=? AND active=1')
    .bind(claims.tenantId,claims.sub).first();
  requireValue(row && row.auth_version === claims.version, 401, 'Unauthorized');
  return {tenantId:claims.tenantId,actorId:claims.sub,role:row.role,product:env.PRODUCT};
}
export function canWrite(actor) { requireValue(['staff','manager','admin'].includes(actor.role),403,'Forbidden'); }
export async function rateLimit(db, actor, kind, limit, now = Date.now()) {
  const bucket = Math.floor(now/60000);
  const result = await db.prepare(`INSERT INTO one_ai_rate_limits (tenant_id,actor_id,kind,bucket,hits) VALUES (?,?,?,?,1)
    ON CONFLICT(tenant_id,actor_id,kind) DO UPDATE SET bucket=excluded.bucket,
    hits=CASE WHEN one_ai_rate_limits.bucket=excluded.bucket THEN one_ai_rate_limits.hits+1 ELSE 1 END RETURNING hits`)
    .bind(actor.tenantId,actor.actorId,kind,bucket).first();
  requireValue(result.hits <= limit,429,'Rate limit exceeded');
}
