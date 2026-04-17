-- Creatomate Social Posts: generation history (per user, per client/workspace).

create table if not exists public.social_post_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,

  template_name text not null,

  headline text not null,
  subheadline text not null,
  body text not null,
  image_top text not null,
  image_middle text not null,
  image_bottom text not null,

  output_url text not null,

  created_at timestamptz not null default now()
);

create index if not exists social_post_generations_user_client_created_idx
  on public.social_post_generations (user_id, client_id, created_at desc);

create index if not exists social_post_generations_client_created_idx
  on public.social_post_generations (client_id, created_at desc);

alter table public.social_post_generations enable row level security;

create policy "social_post_generations_select_own"
  on public.social_post_generations for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_post_generations_insert_own"
  on public.social_post_generations for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_post_generations_delete_own"
  on public.social_post_generations for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

comment on table public.social_post_generations is 'Creatomate social post image generations (scoped to client/workspace).';

