-- Create athletes table
create table athletes (
  id uuid default gen_random_uuid() primary key,
  coach_id text not null,
  name text not null,
  age integer,
  gender text,
  created_at timestamptz default now()
);

-- Create training_logs table
create table training_logs (
  id uuid default gen_random_uuid() primary key,
  athlete_id uuid references athletes(id) on delete cascade not null,
  date date not null,
  distance_km numeric not null,
  created_at timestamptz default now()
);

-- Create performance_entries table
create table performance_entries (
  id uuid default gen_random_uuid() primary key,
  log_id uuid references training_logs(id) on delete cascade not null,
  stroke text not null,
  time_seconds numeric not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table athletes enable row level security;
alter table training_logs enable row level security;
alter table performance_entries enable row level security;

-- Create policies (Allow all for anon for MVP simplicity, app logic handles filtering)
create policy "Allow all operations for anon" on athletes for all to anon using (true) with check (true);
create policy "Allow all operations for anon" on training_logs for all to anon using (true) with check (true);
create policy "Allow all operations for anon" on performance_entries for all to anon using (true) with check (true);

-- Grant permissions
grant select, insert, update, delete on athletes to anon;
grant select, insert, update, delete on training_logs to anon;
grant select, insert, update, delete on performance_entries to anon;
