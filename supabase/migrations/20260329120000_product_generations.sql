-- ProductGenie: store generated product copy per user (MVP history + future shared History UI)
create table if not exists public.product_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_name text not null,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_generations_user_created_idx
  on public.product_generations (user_id, created_at desc);

alter table public.product_generations enable row level security;

create policy "product_generations_select_own"
  on public.product_generations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "product_generations_insert_own"
  on public.product_generations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "product_generations_delete_own"
  on public.product_generations for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.product_generations is 'ProductGenie AI outputs; input_data/output_data JSON for History integration.';
