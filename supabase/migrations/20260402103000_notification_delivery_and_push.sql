-- Notification delivery channels (email/push) + user preferences + web push subscriptions.

create table if not exists public.user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  email_enabled boolean not null default true,
  email_digest_frequency text not null default 'daily' check (email_digest_frequency in ('off', 'instant', 'daily', 'weekly')),
  push_enabled boolean not null default false,
  push_instant_severity text not null default 'critical' check (push_instant_severity in ('info', 'success', 'warning', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_notification_settings_user_client_unique unique (user_id, client_id)
);

create index if not exists user_notification_settings_user_client_idx
  on public.user_notification_settings (user_id, client_id);

alter table public.user_notification_settings enable row level security;

drop policy if exists "user_notification_settings_select_own" on public.user_notification_settings;
drop policy if exists "user_notification_settings_upsert_own" on public.user_notification_settings;
drop policy if exists "user_notification_settings_delete_own" on public.user_notification_settings;

create policy "user_notification_settings_select_own"
  on public.user_notification_settings for select
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

create policy "user_notification_settings_upsert_own"
  on public.user_notification_settings for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "user_notification_settings_update_own"
  on public.user_notification_settings for update
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id))
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "user_notification_settings_delete_own"
  on public.user_notification_settings for delete
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

comment on table public.user_notification_settings is 'Per-user, per-client notification delivery preferences (email digest + push).';

-- Web push subscriptions (browser/device tokens)
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint web_push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists web_push_subscriptions_user_client_created_idx
  on public.web_push_subscriptions (user_id, client_id, created_at desc);

alter table public.web_push_subscriptions enable row level security;

drop policy if exists "web_push_subscriptions_select_own" on public.web_push_subscriptions;
drop policy if exists "web_push_subscriptions_insert_own" on public.web_push_subscriptions;
drop policy if exists "web_push_subscriptions_delete_own" on public.web_push_subscriptions;

create policy "web_push_subscriptions_select_own"
  on public.web_push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

create policy "web_push_subscriptions_insert_own"
  on public.web_push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "web_push_subscriptions_delete_own"
  on public.web_push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

comment on table public.web_push_subscriptions is 'Browser push subscriptions per user/client.';

-- Delivery tracking to avoid duplicate sends
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  delivered_at timestamptz not null default now(),
  provider_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  constraint notification_deliveries_unique unique (notification_id, channel)
);

create index if not exists notification_deliveries_channel_delivered_idx
  on public.notification_deliveries (channel, delivered_at desc);

alter table public.notification_deliveries enable row level security;

-- Users may see their own deliveries via notification ownership (optional, read-only).
drop policy if exists "notification_deliveries_select_own" on public.notification_deliveries;

create policy "notification_deliveries_select_own"
  on public.notification_deliveries for select
  to authenticated
  using (
    exists (
      select 1
      from public.notifications n
      where n.id = notification_deliveries.notification_id
        and n.user_id = auth.uid()
        and public.is_client_member(n.client_id)
    )
  );

comment on table public.notification_deliveries is 'Channel delivery log for notifications (email/push). Inserts typically done by server role/cron.';

