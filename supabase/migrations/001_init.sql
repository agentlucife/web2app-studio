-- Web2App Studio — complete initial schema.
-- Apply to a fresh Supabase project. Existing installations should apply
-- 002_upgrade.sql instead (it is idempotent and preserves existing tables).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  github_username text,
  role text not null default 'user' check (role in ('user','admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','enterprise')),
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- github_connections
-- ---------------------------------------------------------------------------
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  github_user_id bigint,
  github_username text,
  avatar_url text,
  encrypted_token text not null,
  token_type text not null default 'pat' check (token_type in ('pat','oauth')),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  website_url text not null,
  package_id text not null,
  bundle_id text,
  icon_url text,
  splash_url text,
  platforms text[] not null default '{android}',
  repo_full_name text,
  repo_branch text not null default 'main',
  repo_private boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists projects_updated_at_idx on projects(updated_at desc);
create index if not exists projects_repo_idx on projects(repo_full_name);

-- ---------------------------------------------------------------------------
-- app_configurations (versioned copy of project.config for auditing)
-- ---------------------------------------------------------------------------
create table if not exists app_configurations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- builds
-- ---------------------------------------------------------------------------
create table if not exists builds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android','ios')),
  build_type text not null,
  status text not null default 'queued'
    check (status in ('queued','preparing','building','uploading','completed','failed','cancelled')),
  workflow_run_id bigint,
  workflow_run_url text,
  workflow_name text,
  commit_sha text,
  signing_mode text,
  artifact_name text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builds_user_id_idx on builds(user_id, created_at desc);
create index if not exists builds_project_id_idx on builds(project_id, created_at desc);
create index if not exists builds_status_idx on builds(status);
create index if not exists builds_workflow_run_idx on builds(workflow_run_id);

-- ---------------------------------------------------------------------------
-- build_logs
-- ---------------------------------------------------------------------------
create table if not exists build_logs (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id) on delete cascade,
  level text not null default 'info' check (level in ('info','warn','error','success')),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists build_logs_build_idx on build_logs(build_id, created_at);

-- ---------------------------------------------------------------------------
-- artifacts
-- ---------------------------------------------------------------------------
create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  build_id uuid references builds(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  content_type text,
  kind text not null default 'apk'
    check (kind in ('apk','aab','ipa','xcarchive','source','log')),
  checksum text,
  created_at timestamptz not null default now()
);
create index if not exists artifacts_user_idx on artifacts(user_id, created_at desc);
create index if not exists artifacts_build_idx on artifacts(build_id);
create index if not exists artifacts_project_idx on artifacts(project_id, created_at desc);
create unique index if not exists artifacts_storage_path_key on artifacts(storage_path);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'info',
  read boolean not null default false,
  build_id uuid references builds(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, read, created_at desc);

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on support_tickets(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_settings
-- ---------------------------------------------------------------------------
create table if not exists admin_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into admin_settings (key, value)
values ('platform', '{"maintenanceMode":false,"signupsEnabled":true,"buildNotifications":true,"supportEmail":"support@web2app.studio"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['profiles','subscriptions','github_connections','projects','app_configurations','builds','support_tickets']
  loop
    execute format('drop trigger if exists %I_set_updated_at on %I', tbl, tbl);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- new-user provisioning
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, github_username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username')
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, profiles.email),
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
        github_username = coalesce(excluded.github_username, profiles.github_username),
        updated_at = now();

  insert into public.subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles/subscriptions for accounts that already exist.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- prevent privilege escalation through the profile update policy
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.suspended is distinct from old.suspended)
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
     ) then
    raise exception 'Only administrators can change roles or suspension status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on profiles;
create trigger protect_profile_fields_trigger
before update on profiles
for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table github_connections enable row level security;
alter table projects enable row level security;
alter table app_configurations enable row level security;
alter table builds enable row level security;
alter table build_logs enable row level security;
alter table artifacts enable row level security;
alter table notifications enable row level security;
alter table support_tickets enable row level security;
alter table admin_settings enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "subscriptions_select_own" on subscriptions;
create policy "subscriptions_select_own" on subscriptions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "github_select_own" on github_connections;
create policy "github_select_own" on github_connections for select to authenticated using (auth.uid() = user_id);
drop policy if exists "github_delete_own" on github_connections;
create policy "github_delete_own" on github_connections for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "projects_own" on projects;
create policy "projects_own" on projects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "app_configurations_own" on app_configurations;
create policy "app_configurations_own" on app_configurations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "builds_select_own" on builds;
create policy "builds_select_own" on builds for select to authenticated using (auth.uid() = user_id);

drop policy if exists "build_logs_select_own" on build_logs;
create policy "build_logs_select_own" on build_logs for select to authenticated using (
  exists (select 1 from builds b where b.id = build_logs.build_id and b.user_id = auth.uid())
);

drop policy if exists "artifacts_select_own" on artifacts;
create policy "artifacts_select_own" on artifacts for select to authenticated using (auth.uid() = user_id);

drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "support_tickets_select_own" on support_tickets;
create policy "support_tickets_select_own" on support_tickets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "support_tickets_insert_own" on support_tickets;
create policy "support_tickets_insert_own" on support_tickets for insert to authenticated with check (auth.uid() = user_id);

-- admin_settings is service-role only: no policies.

-- ---------------------------------------------------------------------------
-- Privileges (RLS still applies to authenticated)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, update on profiles to authenticated;
-- Column-level grants: the browser must never be able to read encrypted_token,
-- even for its own row. (A column REVOKE does not override a table-level GRANT.)
revoke all on github_connections from anon, authenticated;
grant select (id, user_id, github_user_id, github_username, avatar_url, token_type, scopes, connected_at, updated_at)
  on github_connections to authenticated;
grant delete on github_connections to authenticated;
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on app_configurations to authenticated;
grant select on builds to authenticated;
grant select on build_logs to authenticated;
grant select on artifacts to authenticated;
grant select, update on notifications to authenticated;
grant select on subscriptions to authenticated;
grant select, insert on support_tickets to authenticated;
revoke all on admin_settings from anon, authenticated;
