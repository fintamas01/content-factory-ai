-- Notifications / Alerts Engine (MVP): in-app, client-scoped, user-specific feed.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source_module text not null check (source_module in ('audit', 'products', 'autopilot', 'sprint', 'competitor', 'playbooks', 'system')),
  action_label text,
  action_url text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_client_created_idx
  on public.notifications (user_id, client_id, created_at desc);

create index if not exists notifications_user_client_unread_idx
  on public.notifications (user_id, client_id, is_read, created_at desc);

comment on table public.notifications is 'In-app alerts and tasks for retention; scoped by user + client.';

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

create policy "notifications_insert_own"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id))
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

