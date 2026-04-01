-- Team collaboration: client_members + client_invites; RLS aligned to workspace membership.

create table if not exists public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  constraint client_members_client_user_unique unique (client_id, user_id)
);

create index if not exists client_members_user_idx
  on public.client_members (user_id, created_at desc);
create index if not exists client_members_client_idx
  on public.client_members (client_id, created_at desc);

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now()
);

create unique index if not exists client_invites_client_email_lower_uidx
  on public.client_invites (client_id, lower(trim(email)));

create index if not exists client_invites_client_idx
  on public.client_invites (client_id, created_at desc);
create index if not exists client_invites_token_idx
  on public.client_invites (token);

comment on table public.client_members is 'Workspace membership and role per client.';
comment on table public.client_invites is 'Email invites to join a workspace (MVP: token shown in UI, no outbound email).';

-- Backfill: every existing client owner becomes an owner member.
insert into public.client_members (client_id, user_id, role)
select c.id, c.user_id, 'owner'
from public.clients c
on conflict (client_id, user_id) do nothing;

-- New clients: auto-add creator as owner member.
create or replace function public.clients_after_insert_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_members (client_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (client_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists clients_after_insert_add_owner_member on public.clients;
create trigger clients_after_insert_add_owner_member
  after insert on public.clients
  for each row
  execute function public.clients_after_insert_add_owner_member();

-- Helper for RLS (stable, fast).
create or replace function public.is_client_member(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_members m
    where m.client_id = p_client_id
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_client_member(uuid) to authenticated;

create or replace function public.client_member_role(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.client_members m
  where m.client_id = p_client_id
    and m.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.client_member_role(uuid) to authenticated;

-- ---- clients: workspace-visible to members; delete only owner role ----
alter table public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_delete_own" on public.clients;

create policy "clients_select_member"
  on public.clients for select
  to authenticated
  using (public.is_client_member(id));

create policy "clients_insert_creator"
  on public.clients for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "clients_update_admin"
  on public.clients for update
  to authenticated
  using (
    public.client_member_role(id) in ('owner', 'admin')
  )
  with check (
    public.client_member_role(id) in ('owner', 'admin')
  );

create policy "clients_delete_owner_only"
  on public.clients for delete
  to authenticated
  using (public.client_member_role(id) = 'owner');

-- ---- client_members policies ----
alter table public.client_members enable row level security;

create policy "client_members_select_same_workspace"
  on public.client_members for select
  to authenticated
  using (public.is_client_member(client_id));

create policy "client_members_insert_by_admin"
  on public.client_members for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_members.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "client_members_update_by_admin"
  on public.client_members for update
  to authenticated
  using (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_members.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_members.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Self-leave always; owner may remove admin/member; admin may remove member only (never owner or other admins).
create policy "client_members_delete_by_admin_or_self"
  on public.client_members for delete
  to authenticated
  using (
    client_members.user_id = auth.uid()
    or (
      public.client_member_role(client_members.client_id) = 'owner'
      and client_members.role in ('admin', 'member')
    )
    or (
      public.client_member_role(client_members.client_id) = 'admin'
      and client_members.role = 'member'
    )
  );

-- ---- client_invites policies ----
alter table public.client_invites enable row level security;

create policy "client_invites_select"
  on public.client_invites for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_invites.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
    or lower(trim(client_invites.email)) = lower(trim(auth.jwt() ->> 'email'))
  );

create policy "client_invites_insert_admin"
  on public.client_invites for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_invites.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
    and role <> 'owner'
  );

create policy "client_invites_update_invitee_or_admin"
  on public.client_invites for update
  to authenticated
  using (
    (
      lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
      and status = 'pending'
    )
    or exists (
      select 1
      from public.client_members m
      where m.client_id = client_invites.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    (
      lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
    )
    or exists (
      select 1
      from public.client_members m
      where m.client_id = client_invites.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "client_invites_delete_admin"
  on public.client_invites for delete
  to authenticated
  using (
    exists (
      select 1
      from public.client_members m
      where m.client_id = client_invites.client_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ---- Replace workspace data RLS: any member can read/write; delete with admin/owner or self ----
do $$
begin
  -- product_generations
  drop policy if exists product_generations_select_own on public.product_generations;
  drop policy if exists product_generations_insert_own on public.product_generations;
  drop policy if exists product_generations_delete_own on public.product_generations;
  create policy "product_generations_select_member"
    on public.product_generations for select to authenticated
    using (public.is_client_member(client_id));
  create policy "product_generations_insert_member"
    on public.product_generations for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "product_generations_delete_member"
    on public.product_generations for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  -- generations
  drop policy if exists generations_select_own on public.generations;
  drop policy if exists generations_insert_own on public.generations;
  drop policy if exists generations_delete_own on public.generations;
  create policy "generations_select_member"
    on public.generations for select to authenticated
    using (public.is_client_member(client_id));
  create policy "generations_insert_member"
    on public.generations for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "generations_delete_member"
    on public.generations for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  -- site_audit_runs
  drop policy if exists site_audit_runs_select_own on public.site_audit_runs;
  drop policy if exists site_audit_runs_insert_own on public.site_audit_runs;
  drop policy if exists site_audit_runs_delete_own on public.site_audit_runs;
  create policy "site_audit_runs_select_member"
    on public.site_audit_runs for select to authenticated
    using (public.is_client_member(client_id));
  create policy "site_audit_runs_insert_member"
    on public.site_audit_runs for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "site_audit_runs_delete_member"
    on public.site_audit_runs for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  -- matrix_generations
  drop policy if exists matrix_generations_select_own on public.matrix_generations;
  drop policy if exists matrix_generations_insert_own on public.matrix_generations;
  drop policy if exists matrix_generations_delete_own on public.matrix_generations;
  create policy "matrix_generations_select_member"
    on public.matrix_generations for select to authenticated
    using (public.is_client_member(client_id));
  create policy "matrix_generations_insert_member"
    on public.matrix_generations for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "matrix_generations_delete_member"
    on public.matrix_generations for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  -- autopilot_jobs
  drop policy if exists autopilot_jobs_select_own on public.autopilot_jobs;
  drop policy if exists autopilot_jobs_insert_own on public.autopilot_jobs;
  drop policy if exists autopilot_jobs_update_own on public.autopilot_jobs;
  drop policy if exists autopilot_jobs_delete_own on public.autopilot_jobs;
  create policy "autopilot_jobs_select_member"
    on public.autopilot_jobs for select to authenticated
    using (public.is_client_member(client_id));
  create policy "autopilot_jobs_insert_member"
    on public.autopilot_jobs for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "autopilot_jobs_update_member"
    on public.autopilot_jobs for update to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    )
    with check (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );
  create policy "autopilot_jobs_delete_member"
    on public.autopilot_jobs for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  -- autopilot_results
  drop policy if exists autopilot_results_select_own on public.autopilot_results;
  drop policy if exists autopilot_results_insert_own on public.autopilot_results;
  drop policy if exists autopilot_results_delete_own on public.autopilot_results;
  create policy "autopilot_results_select_member"
    on public.autopilot_results for select to authenticated
    using (public.is_client_member(client_id));
  create policy "autopilot_results_insert_member"
    on public.autopilot_results for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "autopilot_results_delete_member"
    on public.autopilot_results for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );
end $$;

-- user_brand_profiles + woocommerce: member read; insert/update own row or admin
do $$
begin
  drop policy if exists user_brand_profiles_select_own on public.user_brand_profiles;
  drop policy if exists user_brand_profiles_insert_own on public.user_brand_profiles;
  drop policy if exists user_brand_profiles_update_own on public.user_brand_profiles;
  drop policy if exists user_brand_profiles_delete_own on public.user_brand_profiles;

  create policy "user_brand_profiles_select_member"
    on public.user_brand_profiles for select to authenticated
    using (public.is_client_member(client_id));
  create policy "user_brand_profiles_insert_member"
    on public.user_brand_profiles for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "user_brand_profiles_update_member"
    on public.user_brand_profiles for update to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    )
    with check (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );
  create policy "user_brand_profiles_delete_member"
    on public.user_brand_profiles for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );

  drop policy if exists woocommerce_connections_select_own on public.woocommerce_connections;
  drop policy if exists woocommerce_connections_upsert_own on public.woocommerce_connections;
  drop policy if exists woocommerce_connections_update_own on public.woocommerce_connections;
  drop policy if exists woocommerce_connections_delete_own on public.woocommerce_connections;

  create policy "woocommerce_connections_select_member"
    on public.woocommerce_connections for select to authenticated
    using (public.is_client_member(client_id));
  create policy "woocommerce_connections_insert_member"
    on public.woocommerce_connections for insert to authenticated
    with check (auth.uid() = user_id and public.is_client_member(client_id));
  create policy "woocommerce_connections_update_member"
    on public.woocommerce_connections for update to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    )
    with check (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );
  create policy "woocommerce_connections_delete_member"
    on public.woocommerce_connections for delete to authenticated
    using (
      public.is_client_member(client_id)
      and (
        auth.uid() = user_id
        or public.client_member_role(client_id) in ('owner', 'admin')
      )
    );
end $$;

-- monthly_usage: members can read their own counter rows; RPC increments
drop policy if exists monthly_usage_select_own on public.monthly_usage;
create policy "monthly_usage_select_member"
  on public.monthly_usage for select to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));

-- Usage RPC: allow any workspace member to increment their own counters for that client.
create or replace function public.increment_monthly_usage(p_feature text, p_client_id uuid)
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
  if p_client_id is null then
    raise exception 'Missing client_id';
  end if;
  if not public.is_client_member(p_client_id) then
    raise exception 'Invalid client_id';
  end if;
  if p_feature is null or p_feature not in ('content', 'product', 'audit') then
    raise exception 'Invalid feature';
  end if;

  insert into public.monthly_usage (
    user_id,
    client_id,
    month_key,
    content_count,
    product_count,
    audit_count
  )
  values (
    uid,
    p_client_id,
    v_month,
    case when p_feature = 'content' then 1 else 0 end,
    case when p_feature = 'product' then 1 else 0 end,
    case when p_feature = 'audit' then 1 else 0 end
  )
  on conflict (user_id, client_id, month_key) do update set
    content_count = public.monthly_usage.content_count
      + (case when p_feature = 'content' then 1 else 0 end),
    product_count = public.monthly_usage.product_count
      + (case when p_feature = 'product' then 1 else 0 end),
    audit_count = public.monthly_usage.audit_count
      + (case when p_feature = 'audit' then 1 else 0 end),
    updated_at = now();
end;
$$;

grant execute on function public.increment_monthly_usage(text, uuid) to authenticated;

-- Invite accept: invitee cannot INSERT into client_members (RLS); use definer RPC.
create or replace function public.accept_client_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.client_invites%rowtype;
  user_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Missing token';
  end if;

  select * into inv
  from public.client_invites
  where token = p_token
    and status = 'pending';

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  select u.email into user_email
  from auth.users u
  where u.id = uid;

  if user_email is null then
    raise exception 'No email on account';
  end if;

  if lower(trim(inv.email)) <> lower(trim(user_email)) then
    raise exception 'This invite was sent to a different email address';
  end if;

  insert into public.client_members (client_id, user_id, role)
  values (inv.client_id, uid, inv.role)
  on conflict (client_id, user_id) do update
    set role = case
      when public.client_members.role = 'owner' then public.client_members.role
      else excluded.role
    end;

  update public.client_invites
  set status = 'accepted'
  where id = inv.id;

  return inv.client_id;
end;
$$;

grant execute on function public.accept_client_invite(text) to authenticated;
