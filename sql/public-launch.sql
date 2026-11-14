alter table public.order_requests add column if not exists customer_reply text;
create or replace function public.admin_listings() returns setof public.listings
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_members where user_id=auth.uid()) then raise exception 'Accès administrateur requis'; end if;
 return query select * from public.listings order by created_at desc;
end $$;
revoke all on function public.admin_listings() from public,anon;
grant execute on function public.admin_listings() to authenticated;
create or replace function public.admin_order_requests() returns setof public.order_requests
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_members where user_id=auth.uid()) then raise exception 'Accès administrateur requis'; end if;
 return query select * from public.order_requests order by created_at desc limit 100;
end $$;
revoke all on function public.admin_order_requests() from public,anon;
grant execute on function public.admin_order_requests() to authenticated;
create or replace function public.notify_order_reply() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.customer_reply is distinct from old.customer_reply and length(trim(new.customer_reply))>0 then
 insert into public.site_notifications(user_id,kind,title,body,link) values(new.user_id,'reply','Réponse à votre demande',left(new.customer_reply,450),'/mes-demandes.html');
 end if;
 return new;
end $$;
revoke all on function public.notify_order_reply() from public,anon,authenticated;
create trigger order_customer_reply after update of customer_reply on public.order_requests for each row execute function public.notify_order_reply();
-- A customer must not forge the initial reply.
create policy "Customer reply starts empty" on public.order_requests as restrictive for insert to authenticated with check(customer_reply is null);
