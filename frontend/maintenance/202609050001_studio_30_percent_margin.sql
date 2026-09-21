-- 30% minimum Kie-only margin on active image/video generation.
-- Costs verified at https://kie.ai/pricing on 2026-09-05.
-- Formula: ceil(provider USD / (0.70 * 0.007999 USD per customer credit)).
-- Video matrices retain fractional per-second rates, rounding only the total.
-- No pack, balance, historical generation or chat changes.
begin;
lock table public.studio_models, public.studio_credit_packs in share row exclusive mode;
create temporary table pricing_change (key text primary key, old_cost integer, old_rules jsonb, new_cost integer, new_rules jsonb) on commit drop;
insert into pricing_change values
('nano-banana-2-1k', 12, '{"keys": ["resolution"], "rates": {"1K": 12, "2K": 18, "4K": 27}, "strategy": "matrix"}'::jsonb, 8, '{"keys": ["resolution"], "rates": {"1K": 7.14375012, "2K": 10.71562517, "4K": 16.07343776}, "strategy": "matrix"}'::jsonb),
('flux-2-flex-1k', 20, '{"keys": ["resolution"], "rates": {"1K": 20, "2K": 36}, "strategy": "matrix"}'::jsonb, 13, '{"keys": ["resolution"], "rates": {"1K": 12.5015627, "2K": 21.43125034}, "strategy": "matrix"}'::jsonb),
('gpt-image-2', 9, '{"keys": ["resolution"], "rates": {"1K": 9, "2K": 15, "4K": 24}, "strategy": "matrix"}'::jsonb, 6, '{"keys": ["resolution"], "rates": {"1K": 5.35781259, "2K": 8.92968764, "4K": 14.28750023}, "strategy": "matrix"}'::jsonb),
('gpt-image-1-5', 6, '{"keys": ["quality"], "rates": {"high": 33, "medium": 6}, "strategy": "matrix"}'::jsonb, 4, '{"keys": ["quality"], "rates": {"medium": 3.57187506, "high": 19.64531281}, "strategy": "matrix"}'::jsonb),
('seedream-5-lite', 9, '{"strategy": "fixed"}'::jsonb, 5, '{"strategy": "fixed"}'::jsonb),
('seedream-5-pro', 11, '{"keys": ["quality"], "rates": {"high": 21, "basic": 11}, "strategy": "matrix"}'::jsonb, 7, '{"keys": ["quality"], "rates": {"basic": 6.25078135, "high": 12.5015627}, "strategy": "matrix"}'::jsonb),
('seedance-1-5-pro-720p-8s', 42, '{"keys": ["resolution", "generate_audio"], "rates": {"480p|true": 5.25, "720p|true": 10.5, "1080p|true": 22.5, "480p|false": 2.625, "720p|false": 5.25, "1080p|false": 11.25}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb, 26, '{"keys": ["resolution", "generate_audio"], "rates": {"480p|false": 1.56269534, "480p|true": 3.12539068, "720p|false": 3.12539068, "720p|true": 6.25078135, "1080p|false": 6.69726573, "1080p|true": 13.39453146}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb),
('kling-3-video', 105, '{"keys": ["mode", "sound"], "rates": {"4K|true": 100.5, "4K|false": 100.5, "pro|true": 40.5, "std|true": 30, "pro|false": 27, "std|false": 21}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb, 63, '{"keys": ["mode", "sound"], "rates": {"std|false": 12.5015627, "std|true": 17.85937528, "pro|false": 16.07343776, "pro|true": 24.11015663, "4K|false": 59.82890719, "4K|true": 59.82890719}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb),
('wan-3-video', 60, '{"keys": ["resolution"], "rates": {"480P": 12, "720P": 24, "1080P": 48}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb, 36, '{"keys": ["resolution"], "rates": {"480P": 7.14375012, "720P": 16.07343776, "1080P": 28.57500045}, "strategy": "matrix", "multiplierKey": "duration"}'::jsonb);
do $$
begin
  if exists (
    select 1 from public.studio_credit_packs where is_active
    and (currency <> 'usd' or price_cents::numeric / 100 / credits < 0.007999)
  ) then raise exception 'Active pack is cheaper than the audited pricing floor'; end if;
  if (select count(*) from public.studio_models m join pricing_change p using(key)
      where m.is_active and ((m.credit_cost = p.old_cost and m.credit_rules = p.old_rules)
          or (m.credit_cost = p.new_cost and m.credit_rules = p.new_rules))) <> 9
  then raise exception 'Model pricing changed since audit; review before applying'; end if;
end $$;
update public.studio_models m
set credit_cost = p.new_cost, credit_rules = p.new_rules, updated_at = now()
from pricing_change p where m.key = p.key;
commit;
