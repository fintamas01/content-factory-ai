-- Cross-module review workflow: client-scoped queue, payload snapshots, status transitions enforced in API (service role).

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null
    check (module in ('content', 'products', 'site_audit', 'playbooks', 'matrix')),
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'applied')),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  source_kind text,
  source_id uuid,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_items_client_status_created_idx
  on public.review_items (client_id, status, created_at desc);

create index if not exists review_items_client_module_created_idx
  on public.review_items (client_id, module, created_at desc);

create index if not exists review_items_user_created_idx
  on public.review_items (user_id, created_at desc);

comment on table public.review_items is 'Approval queue for AI outputs; status changes via authenticated insert + server-side PATCH (service role).';

create or replace function public.review_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists review_items_set_updated_at on public.review_items;
create trigger review_items_set_updated_at
  before update on public.review_items
  for each row
  execute function public.review_items_set_updated_at();

alter table public.review_items enable row level security;

drop policy if exists "review_items_select_member" on public.review_items;
drop policy if exists "review_items_insert_own" on public.review_items;

-- Members see all review items for their workspace (shared queue).
create policy "review_items_select_member"
  on public.review_items for select
  to authenticated
  using (public.is_client_member(client_id));

-- Creators insert their own rows only.
create policy "review_items_insert_own"
  on public.review_items for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

-- No update/delete for authenticated — workflows use API + service role.

-- Allow notifications to reference review workflow in metadata typing.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'notifications_source_module_check'
  ) then
    alter table public.notifications drop constraint notifications_source_module_check;
  end if;
end $$;

alter table public.notifications
  add constraint notifications_source_module_check
  check (
    source_module in (
      'audit',
      'products',
      'autopilot',
      'sprint',
      'competitor',
      'playbooks',
      'system',
      'review'
    )
  );
