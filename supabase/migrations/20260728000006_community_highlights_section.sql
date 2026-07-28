-- Step 13 of the ops-review plan: expand the existing admin-configurable
-- home section system with a new section (community post highlights),
-- rather than building a separate/parallel mechanism.

insert into public.home_sections (key, is_visible, sort_order)
select 'community_highlights', true, coalesce((select max(sort_order) + 1 from public.home_sections), 0)
where not exists (select 1 from public.home_sections where key = 'community_highlights');
