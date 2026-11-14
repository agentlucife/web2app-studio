-- Enable RLS
alter table if exists profiles enable row level security;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  github_user_id bigint,
  github_username text,
  avatar_url text,
  encrypted_token text not null,
  connected_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  website_url text,
  package_id text,
  bundle_id text,
  description text,
  icon_url text,
  repo_full_name text,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists build_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null,
  status text default 'queued',
  github_run_id bigint,
  artifact_url text,
  logs text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- RLS policies
alter table profiles enable row level security;
alter table github_connections enable row level security;
alter table projects enable row level security;
alter table build_jobs enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Users manage own github connection" on github_connections for all using (auth.uid() = user_id);

create policy "Users manage own projects" on projects for all using (auth.uid() = user_id);

create policy "Users manage own builds" on build_jobs for all using (auth.uid() = user_id);
