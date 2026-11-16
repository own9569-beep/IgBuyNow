begin;
-- Ephemeral fixture accounts; everything is rolled back, including messages and XP.
insert into auth.users(id,email) values
('11111111-0000-4000-8000-000000000001','market-test-seller@example.invalid'),
('11111111-0000-4000-8000-000000000002','market-test-buyer@example.invalid'),
('11111111-0000-4000-8000-000000000003','market-test-other@example.invalid'),
('11111111-0000-4000-8000-000000000004','market-test-admin@example.invalid');
insert into public.admin_members(user_id) values('11111111-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.seller_profiles(id,nickname) values(auth.uid(),'__market_test_seller__');
do $$ begin
 if not exists(select 1 from public.seller_memberships where seller_id=auth.uid() and trial_ends_at=trial_started_at+interval '7 days' and not vip) then raise exception 'FAIL trial'; end if;
 begin update public.seller_memberships set vip=true where seller_id=auth.uid(); raise exception 'FAIL vip escalation'; exception when insufficient_privilege then null; end;
 begin update public.seller_profiles set xp=300,verified=true where id=auth.uid(); raise exception 'FAIL XP escalation'; exception when insufficient_privilege then null; end;
 begin perform public.market_moderate('vip',auth.uid(),'true',''); raise exception 'FAIL admin escalation'; exception when raise_exception then if SQLERRM<>'Accès administrateur requis' then raise; end if; end;
end $$;
insert into public.market_listings(seller_id,game,title,description,status,image_urls) values(auth.uid(),'Test game','Test marketplace listing','A detailed test description for the marketplace.','pending','["https://jnihhfjtxzugkehqwyym.supabase.co/storage/v1/object/public/seller-photos/11111111-0000-4000-8000-000000000001/test.png"]');
do $$ begin
 begin update public.market_listings set status='published' where seller_id=auth.uid(); raise exception 'FAIL self-publish'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('test.listing',(select id::text from public.market_listings where seller_id='11111111-0000-4000-8000-000000000001'),true);
set local role anon;
do $$ begin if exists(select 1 from public.market_listings where id=current_setting('test.listing')::uuid) then raise exception 'FAIL pending public'; end if; end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.market_moderate('listing',current_setting('test.listing')::uuid,'published','Test approval');
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.market_threads(listing_id,buyer_id,seller_id) values(current_setting('test.listing')::uuid,auth.uid(),'11111111-0000-4000-8000-000000000001');
select set_config('test.thread',(select id::text from public.market_threads where listing_id=current_setting('test.listing')::uuid),true);
insert into public.market_messages(thread_id,sender_id,body) values(current_setting('test.thread')::uuid,auth.uid(),'Test private conversation');
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.market_messages where thread_id=current_setting('test.thread')::uuid) then raise exception 'FAIL message leak'; end if;
 if exists(select 1 from public.market_threads where id=current_setting('test.thread')::uuid) then raise exception 'FAIL thread leak'; end if;
 begin insert into public.market_messages(thread_id,sender_id,body) values(current_setting('test.thread')::uuid,auth.uid(),'Intrusion'); raise exception 'FAIL message injection'; exception when insufficient_privilege then null; end;
 update public.market_listings set title='Hijacked listing' where id=current_setting('test.listing')::uuid;
 if found then raise exception 'FAIL listing ownership'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin if (select count(*) from public.market_messages where thread_id=current_setting('test.thread')::uuid)<>1 then raise exception 'FAIL seller message read'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.market_moderate('sale',current_setting('test.thread')::uuid,'','Controlled test sale evidence');
do $$ begin
 if not exists(select 1 from public.seller_profiles where id='11111111-0000-4000-8000-000000000001' and xp=300 and completed_sales=1) then raise exception 'FAIL sale XP'; end if;
 begin perform public.market_moderate('sale',current_setting('test.thread')::uuid,'','Controlled test sale evidence'); raise exception 'FAIL duplicate XP'; exception when raise_exception then if SQLERRM<>'Annonce non disponible ou vente déjà validée' then raise; end if; end;
end $$;
select public.market_moderate('void_sale',current_setting('test.listing')::uuid,'','');
do $$ begin if not exists(select 1 from public.seller_profiles where id='11111111-0000-4000-8000-000000000001' and xp=0 and completed_sales=0) then raise exception 'FAIL rollback XP'; end if; end $$;
reset role;
update public.seller_memberships set trial_started_at=now()-interval '8 days',trial_ends_at=now()-interval '1 day' where seller_id='11111111-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if market_private.can_sell() then raise exception 'FAIL expired trial'; end if;
 begin insert into public.market_listings(seller_id,game,title,description) values(auth.uid(),'Test game','Expired seller listing','This listing must be rejected due to expired trial.'); raise exception 'FAIL expired insert'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.market_moderate('vip','11111111-0000-4000-8000-000000000001','true','');
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin if not market_private.can_sell() or market_private.is_admin() then raise exception 'FAIL VIP segregation'; end if; end $$;
rollback;
select 'PASS: trial, VIP segregation, ownership, moderation, private messages, expiry, XP idempotency and reversal' as result;
