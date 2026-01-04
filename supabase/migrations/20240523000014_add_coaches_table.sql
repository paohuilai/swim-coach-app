-- Create coaches table
create table coaches (
  id text primary key,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table coaches enable row level security;

-- Policies
create policy "Allow public read access" on coaches for select using (true);
create policy "Allow all operations for anon" on coaches for all to anon using (true) with check (true);

-- Grant permissions
grant select, insert, update, delete on coaches to anon;

-- Backfill existing coach_ids from athletes and training_insights
insert into coaches (id, first_name, last_name)
select distinct coach_id, '未知', '教练' from athletes
where coach_id not in (select id from coaches)
on conflict (id) do nothing;

insert into coaches (id, first_name, last_name)
select distinct coach_id, '未知', '教练' from training_insights
where coach_id not in (select id from coaches)
on conflict (id) do nothing;

-- Add Foreign Keys
alter table athletes
add constraint fk_athletes_coach
foreign key (coach_id)
references coaches(id);

alter table training_insights
add constraint fk_insights_coach
foreign key (coach_id)
references coaches(id);
