-- Marketplace v1: no payment collection. Private authorizers, column grants and RLS.
create schema if not exists market_private;
revoke all on schema market_private from public,anon;
grant usage on schema market_private to authenticated;

create table public.seller_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(char_length(btrim(nickname)) between 3 and 40),
 bio text not null default '' check(char_length(bio)<=1000),
 verified boolean not null default false,
 xp integer not null default 0 check(xp>=0),
 completed_sales integer not null default 0 check(completed_sales>=0),
 created_at timestamptz not null default now()
);
create unique index seller_nickname_unique on public.seller_profiles(lower(nickname));
create table public.seller_memberships (
 seller_id uuid primary key references public.seller_profiles(id) on delete cascade,
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now()+interval '7 days'),
 vip boolean not null default false,
 suspended boolean not null default false,
 verification_requested boolean not null default false,
 paid_until timestamptz,
 check(trial_ends_at>=trial_started_at)
);
create table public.market_listings (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.seller_profiles(id),
 game text not null check(char_length(btrim(game)) between 2 and 80),
 category text not null default 'Compte' check(category in ('Compte','Objet','Service','Autre')),
 title text not null check(char_length(btrim(title)) between 5 and 100),
 description text not null check(char_length(btrim(description)) between 20 and 10000),
 price numeric(10,2) check(price>0),
 price_min numeric(10,2), price_max numeric(10,2),
 image_urls jsonb not null default '[]' check(jsonb_typeof(image_urls)='array'),
 status text not null default 'draft' check(status in ('draft','pending','published','rejected','archived','sold')),
 moderation_note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((price_min is null and price_max is null) or (price is null and price_min>=0 and price_max>=price_min and price_min is not null and price_max is not null))
);
create index market_listings_seller on public.market_listings(seller_id);
create index market_listings_catalog on public.market_listings(created_at desc) where status='published';
create table public.market_threads (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.market_listings(id),
 buyer_id uuid not null references auth.users(id),
 seller_id uuid not null references public.seller_profiles(id),
 created_at timestamptz not null default now(),
 unique(listing_id,buyer_id), check(buyer_id<>seller_id)
);
create index market_threads_buyer on public.market_threads(buyer_id,created_at desc);
create index market_threads_seller on public.market_threads(seller_id,created_at desc);
create table public.market_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.market_threads(id),
 sender_id uuid not null references auth.users(id),
 body text not null check(char_length(btrim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index market_messages_thread on public.market_messages(thread_id,created_at desc,id);
create index market_messages_sender on public.market_messages(sender_id,created_at desc);
create table public.market_sales (
 listing_id uuid primary key references public.market_listings(id),
 thread_id uuid not null references public.market_threads(id),
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),
 state text not null default 'confirmed' check(state in ('confirmed','void')),
 evidence_note text not null check(char_length(btrim(evidence_note)) between 10 and 2000)
);
create table public.market_audit (id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id), target_id uuid not null, action text not null, note text not null, created_at timestamptz not null default now());
alter table public.market_audit enable row level security;
revoke all on public.market_audit from anon,authenticated;
grant select on public.market_audit to authenticated;
create table public.market_reports (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.market_listings(id),
 reporter_id uuid not null references auth.users(id),
 reason text not null check(char_length(btrim(reason)) between 10 and 1000),
 created_at timestamptz not null default now(),
 unique(listing_id,reporter_id)
);
create index market_reports_reporter on public.market_reports(reporter_id);

create function market_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.admin_members where user_id=auth.uid())
$$;
create function market_private.allowed_user() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(select 1 from public.account_controls where user_id=auth.uid() and banned)
$$;
create function market_private.can_sell() returns boolean language sql stable security definer set search_path='' as $$
 select market_private.allowed_user() and exists(select 1 from public.seller_memberships where seller_id=auth.uid() and not suspended and (vip or trial_ends_at>now() or paid_until>now()))
$$;
create function market_private.visible_seller(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.seller_memberships m where m.seller_id=p_id and not m.suspended and (m.vip or m.trial_ends_at>now() or m.paid_until>now())) and not exists(select 1 from public.account_controls where user_id=p_id and banned)
$$;
-- Used by public catalog policies. Returns only public visibility, never membership details.
grant usage on schema market_private to anon;
create function market_private.joined() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.seller_memberships(seller_id) values(new.id); return new; end $$;
create trigger seller_joined after insert on public.seller_profiles for each row execute function market_private.joined();

alter table public.seller_profiles enable row level security;
alter table public.seller_memberships enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_threads enable row level security;
alter table public.market_messages enable row level security;
alter table public.market_sales enable row level security;
alter table public.market_reports enable row level security;
revoke all on public.seller_profiles,public.seller_memberships,public.market_listings,public.market_threads,public.market_messages,public.market_sales,public.market_reports from anon,authenticated;
grant select on public.seller_profiles to anon,authenticated;
grant insert(id,nickname,bio),update(nickname,bio) on public.seller_profiles to authenticated;
grant select on public.seller_memberships to authenticated;
grant update(verification_requested) on public.seller_memberships to authenticated;
grant select on public.market_listings to anon,authenticated;
grant insert(seller_id,game,category,title,description,price,price_min,price_max,image_urls,status),update(game,category,title,description,price,price_min,price_max,image_urls,status) on public.market_listings to authenticated;
grant select on public.market_threads,public.market_messages,public.market_sales,public.market_reports to authenticated;
grant insert(listing_id,buyer_id,seller_id) on public.market_threads to authenticated;
grant insert(thread_id,sender_id,body) on public.market_messages to authenticated;
grant insert(listing_id,reporter_id,reason) on public.market_reports to authenticated;
create policy audit_admin on public.market_audit for select to authenticated using(market_private.is_admin());
create policy seller_public on public.seller_profiles for select to anon,authenticated using(true);
create policy seller_join on public.seller_profiles for insert to authenticated with check(id=(select auth.uid()) and market_private.allowed_user());
create policy seller_edit on public.seller_profiles for update to authenticated using(id=(select auth.uid()) and market_private.allowed_user()) with check(id=(select auth.uid()));
create policy membership_read on public.seller_memberships for select to authenticated using(seller_id=(select auth.uid()) or market_private.is_admin());
create policy membership_request on public.seller_memberships for update to authenticated using(seller_id=(select auth.uid()) and market_private.allowed_user()) with check(seller_id=(select auth.uid()));
create policy market_public on public.market_listings for select to anon,authenticated using(status in ('published','sold') and market_private.visible_seller(seller_id));
create policy market_owner on public.market_listings for select to authenticated using(seller_id=(select auth.uid()) or market_private.is_admin());
create policy market_insert on public.market_listings for insert to authenticated with check(seller_id=(select auth.uid()) and market_private.can_sell() and status in ('draft','pending'));
create policy market_edit on public.market_listings for update to authenticated using(seller_id=(select auth.uid()) and market_private.can_sell() and status<>'sold') with check(seller_id=(select auth.uid()) and status in ('draft','pending','archived'));
create policy thread_read on public.market_threads for select to authenticated using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
create policy thread_admin_metadata on public.market_threads for select to authenticated using(market_private.is_admin());
create policy thread_start on public.market_threads for insert to authenticated with check(buyer_id=(select auth.uid()) and market_private.allowed_user() and exists(select 1 from public.market_listings l where l.id=listing_id and l.seller_id=market_threads.seller_id and l.status='published'));
create policy message_read on public.market_messages for select to authenticated using(exists(select 1 from public.market_threads t where t.id=thread_id and (t.buyer_id=(select auth.uid()) or t.seller_id=(select auth.uid()))));
create policy message_send on public.market_messages for insert to authenticated with check(sender_id=(select auth.uid()) and market_private.allowed_user() and exists(select 1 from public.market_threads t where t.id=thread_id and (t.buyer_id=(select auth.uid()) or t.seller_id=(select auth.uid()))));
create policy sale_read on public.market_sales for select to authenticated using(market_private.is_admin() or exists(select 1 from public.market_threads t where t.id=thread_id and (t.buyer_id=(select auth.uid()) or t.seller_id=(select auth.uid()))));
create policy report_read on public.market_reports for select to authenticated using(reporter_id=(select auth.uid()) or market_private.is_admin());
create policy report_send on public.market_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and market_private.allowed_user() and exists(select 1 from public.market_listings l where l.id=listing_id and l.status='published'));

create function market_private.validate_listing() returns trigger language plpgsql set search_path='' as $$
declare u jsonb; prefix text;
begin
 new.updated_at:=now();
 prefix:='https://jnihhfjtxzugkehqwyym.supabase.co/storage/v1/object/public/seller-photos/'||new.seller_id::text||'/';
 for u in select value from jsonb_array_elements(new.image_urls) loop
  if jsonb_typeof(u)<>'string' or left(u#>>'{}',length(prefix))<>prefix or (u#>>'{}') like '%..%' then raise exception 'Utilisez les photos importées dans votre espace vendeur'; end if;
 end loop;
 if new.status='pending' and jsonb_array_length(new.image_urls)=0 then raise exception 'Ajoutez au moins une photo avant publication'; end if;
 if tg_op='INSERT' then
  perform pg_advisory_xact_lock(hashtextextended(new.seller_id::text,91));
  if (select count(*) from public.market_listings where seller_id=new.seller_id and created_at>now()-interval '1 day')>=50 then raise exception 'Limite de 50 nouvelles annonces par jour atteinte'; end if;
 end if;
 return new;
end $$;
create trigger market_listing_validate before insert or update on public.market_listings for each row execute function market_private.validate_listing();
create function market_private.message_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.sender_id<>auth.uid() then raise exception 'Connexion requise'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,92));
 if (select count(*) from public.market_messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=20 then raise exception 'Trop de messages. Réessayez dans une minute.'; end if;
 if exists(select 1 from public.market_threads t join public.seller_memberships m on m.seller_id=t.seller_id where t.id=new.thread_id and m.suspended) then raise exception 'Conversation suspendue'; end if;
 return new;
end $$;
create trigger message_guard before insert on public.market_messages for each row execute function market_private.message_guard();

-- Privileged moderation implementation lives outside the exposed schema.
create function market_private.moderate(action text,target uuid,value text,note text) returns void language plpgsql security definer set search_path='' as $$
declare t public.market_threads; s uuid; lid uuid;
begin
 if not market_private.is_admin() or not market_private.allowed_user() then raise exception 'Accès administrateur requis'; end if;
 if action='listing' then
  if value not in ('published','rejected','archived') then raise exception 'Statut invalide'; end if;
  if value='published' and not exists(select 1 from public.market_listings l where l.id=target and market_private.visible_seller(l.seller_id) and jsonb_array_length(l.image_urls)>0) then raise exception 'Abonnement vendeur actif et photo requis'; end if;
  update public.market_listings set status=value,moderation_note=left(note,500) where id=target and status<>'sold';
 elsif action='vip' then update public.seller_memberships set vip=(value='true') where seller_id=target;
 elsif action='suspend' then update public.seller_memberships set suspended=(value='true') where seller_id=target;
 elsif action='verify' then
  if value='true' and length(btrim(note))<10 then raise exception 'Précisez le contrôle effectué'; end if;
  update public.seller_profiles set verified=(value='true') where id=target;
  update public.seller_memberships set verification_requested=false where seller_id=target;
 elsif action='sale' then
  if char_length(btrim(note))<10 then raise exception 'Justificatif de validation requis'; end if;
  select * into t from public.market_threads where id=target;
  if not found then raise exception 'Conversation introuvable'; end if;
  perform 1 from public.market_listings where id=t.listing_id and seller_id=t.seller_id and status='published' for update;
  if not found then raise exception 'Annonce non disponible ou vente déjà validée'; end if;
  perform 1 from public.seller_profiles where id=t.seller_id for update;
  insert into public.market_sales(listing_id,thread_id,confirmed_by,evidence_note) values(t.listing_id,t.id,auth.uid(),note);
  update public.market_listings set status='sold' where id=t.listing_id;
  update public.seller_profiles set xp=xp+300,completed_sales=completed_sales+1 where id=t.seller_id;
 elsif action='void_sale' then
  select l.seller_id into s from public.market_sales a join public.market_listings l on l.id=a.listing_id where a.listing_id=target and a.state='confirmed' for update of a;
  if s is null then raise exception 'Vente déjà annulée ou introuvable'; end if;
  update public.market_sales set state='void' where listing_id=target;
  update public.seller_profiles set xp=greatest(0,xp-300),completed_sales=greatest(0,completed_sales-1) where id=s;
  update public.market_listings set status='archived' where id=target;
 else raise exception 'Action inconnue'; end if;
 insert into public.market_audit(actor_id,target_id,action,note) values(auth.uid(),target,action,left(value||' | '||note,2000));
end $$;
create function public.market_moderate(action text,target uuid,value text default '',note text default '') returns void language sql security invoker set search_path='' as $$ select market_private.moderate(action,target,value,note) $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('seller-photos','seller-photos',true,10485760,array['image/jpeg','image/png','image/webp','image/gif']);
create policy seller_upload on storage.objects for insert to authenticated with check(bucket_id='seller-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and market_private.can_sell());
create policy seller_photos_read on storage.objects for select to authenticated using(bucket_id='seller-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Photos have immutable random names; no cross-listing replacement or deletion.
revoke all on all functions in schema market_private from public,anon,authenticated;
grant execute on function market_private.is_admin(),market_private.allowed_user(),market_private.can_sell(),market_private.visible_seller(uuid),market_private.moderate(text,uuid,text,text) to authenticated;
grant execute on function market_private.visible_seller(uuid) to anon;
revoke all on function public.market_moderate(text,uuid,text,text) from public,anon;
grant execute on function public.market_moderate(text,uuid,text,text) to authenticated;
