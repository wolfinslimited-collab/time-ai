-- Timeless is subscription-only. Historical wallet and coin transaction rows
-- remain intact for audit/support, but no coin products, rewards or episode
-- unlocks are available to the consumer application.

update public.store_products
set is_active = false
where kind = 'coins';

update public.store_products
set daily_reward_coins = 0
where kind = 'subscription';

alter table public.episodes drop constraint if exists episodes_check;
update public.episodes set coin_price = 0 where coin_price <> 0;

create or replace function public.can_watch_episode(p_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.episodes e
    where e.id = p_episode_id
      and e.status = 'published'
      and (
        e.is_free
        or public.has_active_vip(auth.uid())
      )
  );
$$;

revoke all on function public.unlock_episode(uuid) from authenticated;
revoke all on function public.claim_daily_vip_reward() from authenticated;

grant execute on function public.can_watch_episode(uuid) to authenticated;
