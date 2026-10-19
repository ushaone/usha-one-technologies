-- Additive, single-business MVP. Apply once to the selected Supabase project.
begin;
create table public.vr_settings (
 id boolean primary key default true check(id), paused boolean not null default true,
 business_name text not null default 'USHA ONE Technologies' check(length(business_name) between 1 and 100),
 template text not null default 'నమస్కారం {name} గారు. {business} నుంచి గుర్తు చేస్తున్నాము. మీరు చెల్లించవలసిన మొత్తం {amount} రూపాయలు. గడువు తేదీ {due_date}. ఇప్పటికే చెల్లించి ఉంటే ఈ సందేశాన్ని విస్మరించండి. ధన్యవాదాలు.' check(length(template) between 10 and 1500)
);
insert into public.vr_settings(id) values(true);
create table public.vr_customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 phone text not null unique check(phone ~ '^\+91[6-9][0-9]{9}$'),
 consent boolean not null default false, created_at timestamptz not null default now()
);
create table public.vr_dues (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.vr_customers(id),
 reference text not null unique check(length(reference) between 1 and 80), amount numeric(12,2) not null check(amount>0 and amount<=999999999),
 due_date date not null, state text not null default 'pending' check(state in ('pending','paid','paused')),
 created_at timestamptz not null default now()
);
create table public.vr_attempts (
 id uuid primary key default gen_random_uuid(), due_id uuid not null references public.vr_dues(id),
 status text not null default 'reserved' check(status in ('reserved','dispatching','queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled','uncertain')),
 call_sid text unique, attempt_day date not null default (now() at time zone 'Asia/Kolkata')::date,
 error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(due_id,attempt_day)
);
create index vr_due_scan on public.vr_dues(due_date) where state='pending';
create index vr_attempt_due on public.vr_attempts(due_id,created_at desc);
create function public.vr_import(p_rows jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare r jsonb; cid uuid; n integer:=0;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 or jsonb_array_length(p_rows)=0 then raise exception '1 to 500 rows required'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  insert into public.vr_customers(name,phone,consent) values(r->>'name',r->>'phone',(r->>'consent')::boolean)
  on conflict(phone) do nothing returning id into cid;
  if cid is null then select id into cid from public.vr_customers where phone=r->>'phone'; end if;
  -- Imports never overwrite existing consent or existing invoices.
  insert into public.vr_dues(customer_id,reference,amount,due_date) values(cid,r->>'reference',(r->>'amount')::numeric,(r->>'due_date')::date)
  on conflict(reference) do nothing;
  if found then n:=n+1; end if;
 end loop;
 return n;
end $$;
create function public.vr_claim(p_limit integer default 10) returns setof public.vr_attempts language plpgsql security invoker set search_path='' as $$
declare d public.vr_dues; claimed public.vr_attempts; local_now timestamp := now() at time zone 'Asia/Kolkata'; cfg public.vr_settings;
begin
 select * into cfg from public.vr_settings where id=true for update;
 if cfg.paused or local_now::time < time '09:00' or local_now::time >= time '18:00' then return; end if;
 for d in select x.* from public.vr_dues x join public.vr_customers c on c.id=x.customer_id
 where x.state='pending' and c.consent and x.due_date<=local_now::date
 and (select count(*) from public.vr_attempts a where a.due_id=x.id)<3
 and not exists(select 1 from public.vr_attempts a where a.due_id=x.id and (a.attempt_day=local_now::date or a.status not in ('busy','no-answer','failed','canceled')))
 order by x.due_date,x.created_at limit least(greatest(p_limit,1),10) for update of x skip locked
 loop
  insert into public.vr_attempts(due_id) values(d.id) returning * into claimed; return next claimed;
 end loop;
end $$;
create function public.vr_begin(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.vr_attempts; d public.vr_dues; c public.vr_customers; cfg public.vr_settings;
begin
 select * into cfg from public.vr_settings where id=true for update;
 select * into a from public.vr_attempts where id=p_id for update;
 if a.id is null or a.status<>'reserved' then return null; end if;
 select * into d from public.vr_dues where id=a.due_id for update;
 select * into c from public.vr_customers where id=d.customer_id;
 if cfg.paused or d.state<>'pending' or not c.consent then
  update public.vr_attempts set status='canceled',updated_at=now() where id=p_id; return null;
 end if;
 update public.vr_attempts set status='dispatching',updated_at=now() where id=p_id;
 return jsonb_build_object('attempt',a,'due',d,'customer',c,'settings',cfg);
end $$;
create function public.vr_status(p_id uuid,p_sid text,p_status text,p_error text default null) returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.vr_attempts; old_rank int; new_rank int;
begin
 select * into a from public.vr_attempts where id=p_id for update;
 if a.id is null or (a.call_sid is not null and p_sid is distinct from a.call_sid) then return false; end if;
 if p_status not in ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled','uncertain') then return false; end if;
 if a.status in ('completed','busy','no-answer','failed','canceled') then return a.status=p_status; end if;
 old_rank:=coalesce(array_position(array['reserved','dispatching','uncertain','queued','initiated','ringing','in-progress'],a.status),0);
 new_rank:=coalesce(array_position(array['reserved','dispatching','uncertain','queued','initiated','ringing','in-progress'],p_status),100);
 if new_rank<old_rank then return false; end if;
 update public.vr_attempts set status=p_status,call_sid=coalesce(call_sid,p_sid),error_code=p_error,updated_at=now() where id=p_id;
 return true;
end $$;
alter table public.vr_settings enable row level security;
alter table public.vr_customers enable row level security;
alter table public.vr_dues enable row level security;
alter table public.vr_attempts enable row level security;
revoke all on public.vr_settings,public.vr_customers,public.vr_dues,public.vr_attempts from public,anon,authenticated;
grant select,insert,update on public.vr_settings,public.vr_customers,public.vr_dues,public.vr_attempts to service_role;
revoke execute on function public.vr_import(jsonb),public.vr_claim(integer),public.vr_begin(uuid),public.vr_status(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.vr_import(jsonb),public.vr_claim(integer),public.vr_begin(uuid),public.vr_status(uuid,text,text,text) to service_role;
commit;
