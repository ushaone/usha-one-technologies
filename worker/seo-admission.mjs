// Private Durable Object, reachable only through its namespace binding.
// One fixed instance enforces a rolling 10 admissions/minute and 2 active leases.
// Leases last 30s; gateway DNS+dial hard limit MUST remain below this duration.
// No release endpoint: abandoned work cannot free a slot while still fetching.
export class SeoAuditAdmission {
  constructor(state){this.storage=state.storage}
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/acquire')return new Response(null,{status:404});
    try{
      const result=await this.storage.transaction(async tx=>{
        const now=Date.now();
        const stored=await tx.get('admission');
        if(stored&&(!Array.isArray(stored.starts)||!Array.isArray(stored.leases)||
          stored.starts.some(n=>!Number.isFinite(n))||stored.leases.some(n=>!Number.isFinite(n))))throw Error('Invalid admission state');
        const starts=(stored?.starts||[]).filter(n=>n>now-60000);
        const leases=(stored?.leases||[]).filter(n=>n>now);
        if(starts.length>=10||leases.length>=2)return null;
        starts.push(now);leases.push(now+30000);
        await tx.put('admission',{starts,leases});
        return crypto.randomUUID();
      });
      return Response.json(result?{lease:result}:{error:'Busy'},{status:result?200:429,headers:{'cache-control':'no-store'}});
    }catch{return Response.json({error:'Admission unavailable'},{status:503})}
  }
}
