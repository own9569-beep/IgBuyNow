create or replace function public.admin_write_listings(items jsonb, target_id uuid default null, import_mode boolean default false) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb; r public.listings%rowtype; existing public.listings%rowtype; n integer:=0; found_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_members where user_id=auth.uid()) then raise exception 'Accès administrateur requis'; end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 40 then raise exception 'Lot invalide'; end if;
 if target_id is not null and (import_mode or jsonb_array_length(items)<>1) then raise exception 'Modification invalide'; end if;
 -- Serializes imports and edits; no duplicate supplier references during concurrent imports.
 perform pg_advisory_xact_lock(48193);
 for item in select value from jsonb_array_elements(items) loop
 found_id:=target_id;
 if import_mode then select id into found_id from public.listings where supplier_reference=item->>'supplier_reference'; end if;
 if found_id is not null then
 select * into existing from public.listings where id=found_id for update;
 if not found then raise exception 'Annonce introuvable'; end if;
 r:=jsonb_populate_record(null::public.listings,to_jsonb(existing)||item);
 update public.listings set game=r.game,title=r.title,description=r.description,price=r.price,price_min=r.price_min,price_max=r.price_max,image_url=r.image_url,image_urls=r.image_urls,source_url=r.source_url,supplier_reference=r.supplier_reference,supply_mode=r.supply_mode,offer_type=r.offer_type,discount_percent=r.discount_percent,town_hall_level=r.town_hall_level,active=r.active,sold=r.sold,availability_verified_at=r.availability_verified_at where id=found_id;
 else
 r:=jsonb_populate_record(null::public.listings,'{"game":"Clash of Clans","description":"","active":true,"sold":false,"supply_mode":"stock","offer_type":"standard","discount_percent":0,"image_urls":[]}'::jsonb||item);
 insert into public.listings(game,title,description,price,price_min,price_max,image_url,image_urls,source_url,supplier_reference,supply_mode,offer_type,discount_percent,town_hall_level,active,sold,availability_verified_at) values(r.game,r.title,r.description,r.price,r.price_min,r.price_max,r.image_url,r.image_urls,r.source_url,r.supplier_reference,r.supply_mode,r.offer_type,r.discount_percent,r.town_hall_level,r.active,r.sold,r.availability_verified_at);
 end if;
 n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.admin_write_listings(jsonb,uuid,boolean) from public,anon;
grant execute on function public.admin_write_listings(jsonb,uuid,boolean) to authenticated;
