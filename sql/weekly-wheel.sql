create table public.wheel_config (
 id boolean primary key default true check(id),
 enabled boolean not null default true,
 version integer not null default 1,
 rewards jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.wheel_spins (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 week_start date not null,
 reward jsonb not null,
 bits integer not null check(bits>=0),
 config_version integer not null,
 created_at timestamptz not null default now(),
 unique(user_id,week_start)
);
alter table public.wheel_config enable row level security;
alter table public.wheel_spins enable row level security;
grant select on public.wheel_config to anon,authenticated;
grant select on public.wheel_spins to authenticated;
revoke insert,update,delete on public.wheel_config,public.wheel_spins from anon,authenticated;
create policy "Read wheel configuration" on public.wheel_config for select to anon,authenticated using(true);
create policy "Read own wheel history" on public.wheel_spins for select to authenticated using(user_id=(select auth.uid()));
insert into public.wheel_config(rewards) values ('[
 {"label":"10 Bits","bits":10,"weight":3000},
 {"label":"20 Bits","bits":20,"weight":2500},
 {"label":"35 Bits","bits":35,"weight":1800},
 {"label":"50 Bits","bits":50,"weight":1200},
 {"label":"75 Bits","bits":75,"weight":700},
 {"label":"100 Bits","bits":100,"weight":400},
 {"label":"150 Bits","bits":150,"weight":300},
 {"label":"250 Bits","bits":250,"weight":100}
]');
create or replace function public.weekly_wheel_state() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 uid uuid := auth.uid();
 week_date date := date_trunc('week',now() at time zone 'Europe/Paris')::date;
 response jsonb;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 select jsonb_build_object(
  'balance',coalesce(sum(s.bits),0),
  'played',count(*) filter(where s.week_start=week_date)>0,
  'next_spin_at',(week_date+7)::timestamp at time zone 'Europe/Paris',
  'history',coalesce((select jsonb_agg(to_jsonb(h)) from (
    select reward,bits,created_at,week_start from public.wheel_spins
    where user_id=uid order by created_at desc limit 12
  ) h),'[]'::jsonb)
 ) into response from public.wheel_spins s where s.user_id=uid;
 return response;
end $$;
revoke all on function public.weekly_wheel_state() from public,anon;
grant execute on function public.weekly_wheel_state() to authenticated;

create or replace function public.spin_weekly_wheel() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 week_date date := date_trunc('week',now() at time zone 'Europe/Paris')::date;
 cfg public.wheel_config%rowtype;
 previous public.wheel_spins%rowtype;
 prize jsonb;
 draw integer;
 cumulative integer := 0;
 selected_index integer := -1;
 i integer := 0;
 bytes bytea;
 sample bigint;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 if exists(select 1 from public.account_controls where user_id=uid and banned) then
  raise exception 'Compte suspendu';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,48192));
 select * into previous from public.wheel_spins where user_id=uid and week_start=week_date;
 if found then
  return public.weekly_wheel_state() || jsonb_build_object('already_played',true,'prize',previous.reward);
 end if;
 select * into cfg from public.wheel_config where id=true for share;
 if not found or not cfg.enabled then raise exception 'La roue est momentanément en pause'; end if;
 -- Rejection sampling avoids modulo bias for the 10,000 probability units.
 loop
  bytes := extensions.gen_random_bytes(4);
  sample := get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3)::bigint;
  exit when sample<4294960000;
 end loop;
 draw := sample % 10000;
 for prize in select value from jsonb_array_elements(cfg.rewards) loop
  cumulative := cumulative + (prize->>'weight')::integer;
  if draw<cumulative then selected_index:=i;exit;end if;
  i:=i+1;
 end loop;
 if selected_index<0 then raise exception 'Configuration de probabilités invalide'; end if;
 insert into public.wheel_spins(user_id,week_start,reward,bits,config_version)
 values(uid,week_date,prize,(prize->>'bits')::integer,cfg.version);
 return public.weekly_wheel_state() || jsonb_build_object('already_played',false,'prize',prize,'prize_index',selected_index,'rewards',cfg.rewards);
end $$;
revoke all on function public.spin_weekly_wheel() from public,anon;
grant execute on function public.spin_weekly_wheel() to authenticated;

create or replace function public.configure_weekly_wheel(new_rewards jsonb, new_enabled boolean, expected_version integer) returns integer
language plpgsql security definer set search_path='' as $$
declare
 total integer:=0;
 prize jsonb;
 new_version integer;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_members where user_id=auth.uid()) then
  raise exception 'Accès administrateur requis';
 end if;
 if jsonb_typeof(new_rewards)<>'array' or jsonb_array_length(new_rewards)<>8 then
  raise exception 'La roue doit contenir huit lots';
 end if;
 for prize in select value from jsonb_array_elements(new_rewards) loop
  if jsonb_typeof(prize->'label') is distinct from 'string'
    or length(trim(prize->>'label')) not between 1 and 40
    or jsonb_typeof(prize->'bits') is distinct from 'number'
    or jsonb_typeof(prize->'weight') is distinct from 'number'
    or (prize->>'bits')::numeric not between 0 and 1000000
    or (prize->>'bits')::numeric <> trunc((prize->>'bits')::numeric)
    or (prize->>'weight')::numeric not between 0 and 10000
    or (prize->>'weight')::numeric <> trunc((prize->>'weight')::numeric)
  then raise exception 'Lot invalide'; end if;
  total:=total+(prize->>'weight')::integer;
 end loop;
 if total<>10000 or new_enabled is null then raise exception 'Le total des probabilités doit être de 100 %%'; end if;
 update public.wheel_config set rewards=new_rewards,enabled=new_enabled,version=version+1,updated_at=now()
 where id=true and version=expected_version returning version into new_version;
 if new_version is null then raise exception 'La configuration a changé. Actualisez avant de réessayer.'; end if;
 return new_version;
end $$;
revoke all on function public.configure_weekly_wheel(jsonb,boolean,integer) from public,anon;
grant execute on function public.configure_weekly_wheel(jsonb,boolean,integer) to authenticated;
