-- Monthly usage counters per user (UTC month key YYYY-MM) for SaaS quotas.
create table if not exists public.monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  content_count integer not null default 0,
  product_count integer not null default 0,
  audit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_usage_user_month_unique unique (user_id, month_key)
);

create index if not exists monthly_usage_user_month_idx
  on public.monthly_usage (user_id, month_key);

alter table public.monthly_usage enable row level security;

create policy "monthly_usage_select_own"
  on public.monthly_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts/updates happen via security definer RPC only (keeps increments atomic & trusted).
create policy "monthly_usage_no_direct_insert"
  on public.monthly_usage for insert
  to authenticated
  with check (false);

create policy "monthly_usage_no_direct_update"
  on public.monthly_usage for update
  to authenticated
  using (false);

comment on table public.monthly_usage is 'Per-user monthly counters for Content / Product / Site audit quotas.';

create or replace function public.increment_monthly_usage(p_feature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_month text := to_char((now() at time zone 'utc'), 'YYYY-MM');
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_feature is null or p_feature not in ('content', 'product', 'audit') then
    raise exception 'Invalid feature';
  end if;

  insert into public.monthly_usage (
    user_id,
    month_key,
    content_count,
    product_count,
    audit_count
  )
  values (
    uid,
    v_month,
    case when p_feature = 'content' then 1 else 0 end,
    case when p_feature = 'product' then 1 else 0 end,
    case when p_feature = 'audit' then 1 else 0 end
  )
  on conflict (user_id, month_key) do update set
    content_count = public.monthly_usage.content_count
      + (case when p_feature = 'content' then 1 else 0 end),
    product_count = public.monthly_usage.product_count
      + (case when p_feature = 'product' then 1 else 0 end),
    audit_count = public.monthly_usage.audit_count
      + (case when p_feature = 'audit' then 1 else 0 end),
    updated_at = now();
end;
$$;

grant execute on function public.increment_monthly_usage(text) to authenticated;

create or replace function public.monthly_usage_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_usage_set_updated_at on public.monthly_usage;
create trigger monthly_usage_set_updated_at
  before update on public.monthly_usage
  for each row
  execute function public.monthly_usage_set_updated_at();
