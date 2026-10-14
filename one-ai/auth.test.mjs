import test from 'node:test';
import assert from 'node:assert/strict';
import {signClaims,verifyClaims} from './auth.mjs';
const secret='test-secret-'.repeat(4), scope={issuer:'crm',audience:'one-ai:usha:staging',product:'usha-one'};
const claims={iss:scope.issuer,aud:scope.audience,product:scope.product,tenantId:'t',sub:'user',version:1,iat:1000,exp:1200,jti:'j'};
test('signed identity rejects tampering, key/audience/product mismatch and malformed claims',async()=>{
 const token=await signClaims(claims,secret);assert.ok(await verifyClaims(token,secret,scope,1100));
 for(const [t,s,c,n] of [[token+'a',secret,scope,1100],[token,secret+'other',scope,1100],[token,secret,{...scope,product:'neo-school-india'},1100],[token,secret,{...scope,audience:'prod'},1100],[token,secret,scope,1200],['bad.token',secret,scope,1100]])assert.equal(await verifyClaims(t,s,c,n),null);
 for(const patch of [{iat:1200},{exp:2000},{sub:{}},{version:0},{jti:''},{tenantId:'x'.repeat(129)},{exp:1000}])assert.equal(await verifyClaims(await signClaims({...claims,...patch},secret),secret,scope,1100),null);
});
