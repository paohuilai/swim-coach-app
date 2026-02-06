
-- Create coach_goals table
create table if not exists coach_goals (
  id uuid default gen_random_uuid() primary key,
  coach_id text references coaches(id) not null,
  content text not null,
  created_at timestamptz default now(),
  is_active boolean default true,
  birth_year int,
  custom_group_id uuid references coach_custom_groups(id)
);

-- Create training_tasks table
create table if not exists training_tasks (
  id uuid default gen_random_uuid() primary key,
  coach_id text references coaches(id) not null,
  content text not null,
  deadline date,
  status text default 'pending' check (status in ('pending', 'on_time', 'delayed')),
  created_at timestamptz default now(),
  completed_at timestamptz,
  birth_year int,
  custom_group_id uuid references coach_custom_groups(id)
);

-- Enable RLS
alter table coach_goals enable row level security;
alter table training_tasks enable row level security;

-- Policies for coach_goals
create policy "Users can manage their own goals" on coach_goals
  for all using (auth.uid()::text = coach_id);

-- Policies for training_tasks
create policy "Users can manage their own tasks" on training_tasks
  for all using (auth.uid()::text = coach_id);

-- Grant permissions
grant all on coach_goals to authenticated;
grant all on training_tasks to authenticated;
