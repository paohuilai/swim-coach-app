-- Re-run backfill for coaches table to ensure all existing coach_ids are covered
-- Use a more robust approach to catch all missing IDs

-- 1. Insert missing coaches from athletes table
insert into coaches (id, first_name, last_name)
select distinct coach_id, '未知', '教练' 
from athletes
where coach_id not in (select id from coaches)
on conflict (id) do nothing;

-- 2. Insert missing coaches from training_insights table
insert into coaches (id, first_name, last_name)
select distinct coach_id, '未知', '教练' 
from training_insights
where coach_id not in (select id from coaches)
on conflict (id) do nothing;

-- 3. Update any existing "unknown" coaches if they now have a real name (optional, but good for cleanup if needed)
-- (Skipping this as we trust the upsert in DashboardLayout for real names)

-- 4. Ensure RLS is definitely enabled and open for reading
alter table coaches enable row level security;

drop policy if exists "Allow public read access" on coaches;
create policy "Allow public read access" on coaches for select using (true);

drop policy if exists "Allow all operations for authenticated" on coaches;
create policy "Allow all operations for authenticated" on coaches for all to authenticated using (true) with check (true);

drop policy if exists "Allow all operations for anon" on coaches;
create policy "Allow all operations for anon" on coaches for all to anon using (true) with check (true);

-- 5. Grant permissions again just in case
grant select, insert, update, delete on coaches to anon;
grant select, insert, update, delete on coaches to authenticated;
grant select, insert, update, delete on coaches to service_role;
