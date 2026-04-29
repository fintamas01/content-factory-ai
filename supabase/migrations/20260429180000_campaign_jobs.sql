-- Campaign Jobs: automated ad creative generation queue (per user, per client/workspace).

create table if not exists public.campaign_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,

  product_name text,
  product_image text,
  product_price text,

  headline text,
  caption text,
  cta text,
  template_id text,

  status text not null default 'pending',
  render_url text,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_jobs_user_client_created_idx
  on public.campaign_jobs (user_id, client_id, created_at desc);

alter table public.campaign_jobs enable row level security;

create policy "campaign_jobs_select_own"
  on public.campaign_jobs for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "campaign_jobs_insert_own"
  on public.campaign_jobs for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "campaign_jobs_update_own"
  on public.campaign_jobs for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create or replace function public.campaign_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_jobs_set_updated_at on public.campaign_jobs;
create trigger campaign_jobs_set_updated_at
  before update on public.campaign_jobs
  for each row
  execute function public.campaign_jobs_set_updated_at();

comment on table public.campaign_jobs is 'Campaign jobs queue (scoped to client/workspace).';

