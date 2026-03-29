-- Stripe subscription mirror (webhook upserts via service role).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text,
  price_id text,
  current_period_end timestamptz with time zone,
  created_at timestamptz with time zone not null default now(),
  updated_at timestamptz with time zone not null default now(),
  constraint subscriptions_user_id_key unique (user_id)
);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;

-- Authenticated users can read their own row (webhook writes use service role).
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
