-- AutoPilot (MVP): persisted monitoring jobs + results feed.

create table if not exists public.autopilot_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  competitors text[] not null default '{}'::text[],
  frequency text not null default 'weekly',
  focus text[] not null default '{}'::text[],
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists autopilot_jobs_user_created_idx
  on public.autopilot_jobs (user_id, created_at desc);

create index if not exists autopilot_jobs_user_enabled_idx
  on public.autopilot_jobs (user_id, enabled);

alter table public.autopilot_jobs enable row level security;

create policy "autopilot_jobs_select_own"
  on public.autopilot_jobs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "autopilot_jobs_insert_own"
  on public.autopilot_jobs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "autopilot_jobs_update_own"
  on public.autopilot_jobs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "autopilot_jobs_delete_own"
  on public.autopilot_jobs for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.autopilot_jobs is 'AutoPilot monitoring job configuration per user (MVP: manual trigger; weekly frequency stored).';

create table if not exists public.autopilot_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.autopilot_jobs (id) on delete cascade,
  summary text not null,
  insights jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autopilot_results_user_created_idx
  on public.autopilot_results (user_id, created_at desc);

create index if not exists autopilot_results_job_created_idx
  on public.autopilot_results (job_id, created_at desc);

alter table public.autopilot_results enable row level security;

create policy "autopilot_results_select_own"
  on public.autopilot_results for select
  to authenticated
  using (auth.uid() = user_id);

create policy "autopilot_results_insert_own"
  on public.autopilot_results for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "autopilot_results_delete_own"
  on public.autopilot_results for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.autopilot_results is 'AutoPilot insights feed items generated from audit + competitor intelligence.';

