-- Matrix: store weekly/multi-day content packs per user (History source)
create table if not exists public.matrix_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null default '',
  month_year text,
  generation_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists matrix_generations_user_created_idx
  on public.matrix_generations (user_id, created_at desc);

alter table public.matrix_generations enable row level security;

create policy "matrix_generations_select_own"
  on public.matrix_generations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "matrix_generations_insert_own"
  on public.matrix_generations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "matrix_generations_delete_own"
  on public.matrix_generations for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.matrix_generations is 'Matrix content packs; generation_data JSON for History integration.';

