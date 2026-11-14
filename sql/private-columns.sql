revoke select on public.listings from anon,authenticated;
grant select(id,game,title,description,price,image_url,active,sold,created_at,supply_mode,availability_verified_at,offer_type,discount_percent,town_hall_level,image_urls,price_min,price_max) on public.listings to anon,authenticated;
revoke select on public.order_requests from anon,authenticated;
grant select(id,user_id,listing_id,message,status,created_at,updated_at,customer_reply) on public.order_requests to authenticated;
