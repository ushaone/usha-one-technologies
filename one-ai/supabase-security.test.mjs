import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('./supabase/migrations/20261014125351_harden_existing_usha_profiles_and_view.sql',import.meta.url),'utf8');
const client='11111111-1111-4111-8111-111111111111',staff='22222222-2222-4222-8222-222222222222';
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,email text,phone text,role text NOT NULL,is_active boolean NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()-interval '1 day');
 INSERT INTO public.profiles(id,full_name,role,is_active) VALUES('${client}','Synthetic client','client',true),('${staff}','Synthetic staff','consultant',true);
 CREATE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active=true AND role IN ('super_admin','admin','consultant','developer','support')) $$;
 CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
 CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Staff full access profiles" ON public.profiles FOR ALL TO authenticated USING(public.is_staff() OR id=auth.uid()) WITH CHECK(public.is_staff() OR id=auth.uid());
 GRANT ALL ON public.profiles TO anon,authenticated;
 CREATE TABLE public.opportunities(id uuid,business_id uuid,title text,category text,impact_score integer);
 INSERT INTO public.opportunities VALUES('${client}','${client}','Synthetic private project','test',3);
 ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Staff full access opportunities" ON public.opportunities FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
 GRANT ALL ON public.opportunities TO anon,authenticated;
 CREATE VIEW public.product_signals AS SELECT lower(trim(title)) AS signal,category,count(*) AS request_count,count(DISTINCT business_id) AS businesses_requesting,round(avg(coalesce(impact_score,0)),2) AS avg_impact_score FROM public.opportunities GROUP BY lower(trim(title)),category;
 GRANT SELECT ON public.product_signals TO anon,authenticated;
 `);
 return db;
}
async function as(db,role,subject,query){
 await db.exec('BEGIN');
 try{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[subject]);
  await db.exec('SET LOCAL ROLE '+role);
  const r=await db.query(query);await db.exec('COMMIT');return r;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
test('Postgres fixture reproduces existing profile escalation and view exposure without live writes',async()=>{
 const db=await fixture();try{
  const r=await as(db,'authenticated',client,`UPDATE public.profiles SET role='super_admin' WHERE id='${client}' RETURNING role`);
  assert.equal(r.rows[0].role,'super_admin');
  assert.equal((await as(db,'anon','',"SELECT * FROM public.product_signals")).rows.length,1);
 }finally{await db.close();}
});
test('profile hardening blocks promotion, reactivation, identity changes and replacement while preserving safe edits',async()=>{
 const db=await fixture();try{
  // Include old column grants to verify table-level revocation alone is not relied on.
  await db.exec('GRANT UPDATE(role), INSERT(role) ON public.profiles TO authenticated');
  await db.exec(migration);
  for(const subject of [client,staff])for(const sql of [
   `UPDATE public.profiles SET role='super_admin' WHERE id='${subject}'`,
   `UPDATE public.profiles SET is_active=true WHERE id='${subject}'`,
   `UPDATE public.profiles SET id='33333333-3333-4333-8333-333333333333' WHERE id='${subject}'`,
   `DELETE FROM public.profiles WHERE id='${subject}'`,
   `INSERT INTO public.profiles(id,role,is_active) VALUES('33333333-3333-4333-8333-333333333333','admin',true)`,
   'TRUNCATE public.profiles'
  ])await assert.rejects(()=>as(db,'authenticated',subject,sql),e=>e.code==='42501');
  const updated=await as(db,'authenticated',client,`UPDATE public.profiles SET full_name='Edited',phone='test',email='synthetic@example.invalid' WHERE id='${client}' RETURNING role,full_name,updated_at>created_at-interval '1 second' AS touched`);
  assert.equal(updated.rows[0].role,'client');assert.equal(updated.rows[0].full_name,'Edited');assert.equal(updated.rows[0].touched,true);
  assert.equal((await as(db,'authenticated',client,`UPDATE public.profiles SET full_name='Wrong' WHERE id='${staff}' RETURNING id`)).rows.length,0);
  // A trusted operator still provisions permissions; browser sessions cannot.
  await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${staff}'`);
  assert.equal((await db.query(`SELECT is_active FROM public.profiles WHERE id='${staff}'`)).rows[0].is_active,false);
 }finally{await db.close();}
});
test('invoker view honors base RLS; anonymous denied, client empty, active staff retained',async()=>{
 const db=await fixture();try{
  await db.exec(migration);
  await assert.rejects(()=>as(db,'anon','',"SELECT * FROM public.product_signals"),e=>e.code==='42501');
  assert.equal((await as(db,'authenticated',client,"SELECT * FROM public.product_signals")).rows.length,0);
  assert.equal((await as(db,'authenticated',staff,"SELECT * FROM public.product_signals")).rows.length,1);
  await db.exec(`UPDATE public.profiles SET is_active=false WHERE id='${staff}'`);
  assert.equal((await as(db,'authenticated',staff,"SELECT * FROM public.product_signals")).rows.length,0);
  const config=await db.query("SELECT proconfig FROM pg_proc WHERE proname='set_updated_at'");assert.ok(config.rows[0].proconfig.includes('search_path=pg_catalog'));
 }finally{await db.close();}
});

test('unexpected inherited write grants abort the migration atomically',async()=>{
 const db=await fixture();try{
  await db.exec('CREATE ROLE unexpected_writer; GRANT UPDATE(role) ON public.profiles TO unexpected_writer; GRANT unexpected_writer TO authenticated');
  await assert.rejects(()=>db.exec(migration),/Unexpected inherited privileges/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.profiles','UPDATE') AS retained")).rows[0].retained,true);
  assert.equal((await as(db,'anon','',"SELECT * FROM public.product_signals")).rows.length,1);
 }finally{await db.close();}
});
