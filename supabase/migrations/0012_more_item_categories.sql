-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0012 More activity categories
-- Real trips need more than 5 buckets (e.g. a Jeju trip has 活動/購物/醫美).
-- Add 'activity' and 'shopping' to the itinerary_items category check.
-- ════════════════════════════════════════════════════════════════════════
alter table public.itinerary_items drop constraint if exists itinerary_items_category_check;
alter table public.itinerary_items
  add constraint itinerary_items_category_check
  check (category in ('food', 'transport', 'sight', 'lodging', 'activity', 'shopping', 'other'));
