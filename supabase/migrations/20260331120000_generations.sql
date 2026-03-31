-- ContentFactory: store generated content per user (History source)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  original_content text not null default '',
  tone text,
  results jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy "generations_select_own"
  on public.generations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "generations_insert_own"
  on public.generations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "generations_delete_own"
  on public.generations for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.generations is 'ContentFactory AI outputs; results/metadata JSON for History integration.';

