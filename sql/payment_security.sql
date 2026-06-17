-- Payment and economic security infrastructure.
-- Client-side plan/payment state is not authoritative. Access is granted only
-- by verified payment webhook events or audited server-side manual grants.

create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  user_id uuid null references auth.users(id) on delete set null,
  plan_code text null,
  amount numeric null,
  currency text null,
  payload jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists payment_webhook_events_user_idx
  on public.payment_webhook_events (user_id, processed_at desc);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  plan_code text not null,
  source text not null check (source in ('payment_webhook', 'manual_admin')),
  provider text null,
  provider_customer_id text null,
  provider_subscription_id text null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_payment_event_id text null,
  manual_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature, source)
);

create index if not exists user_entitlements_active_idx
  on public.user_entitlements (user_id, feature, revoked_at, starts_at, expires_at);

create table if not exists public.billing_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users(id) on delete set null,
  target_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  provider text null,
  provider_event_id text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists billing_audit_events_target_idx
  on public.billing_audit_events (target_user_id, created_at desc);

create index if not exists billing_audit_events_provider_idx
  on public.billing_audit_events (provider, provider_event_id);

create table if not exists public.report_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (
    reason in (
      'initial_program_grant',
      'report_package_10',
      'report_package_50',
      'report_package_100',
      'manual_admin_grant',
      'ai_report_consumed',
      'adjustment'
    )
  ),
  source text not null default 'system' check (source in ('payment_webhook', 'manual_admin', 'system')),
  provider text null,
  provider_event_id text null,
  assessment_id uuid null,
  client_id uuid null,
  report_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists report_credit_ledger_user_idx
  on public.report_credit_ledger (user_id, created_at desc);

create unique index if not exists report_credit_ledger_provider_event_reason_idx
  on public.report_credit_ledger (provider, provider_event_id, reason)
  where provider_event_id is not null;

create unique index if not exists report_credit_ledger_assessment_consume_idx
  on public.report_credit_ledger (user_id, assessment_id, reason)
  where assessment_id is not null and reason = 'ai_report_consumed';

alter table public.payment_webhook_events enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.billing_audit_events enable row level security;
alter table public.report_credit_ledger enable row level security;

revoke all on public.payment_webhook_events from anon;
revoke all on public.user_entitlements from anon;
revoke all on public.billing_audit_events from anon;
revoke all on public.report_credit_ledger from anon;
grant select, insert, update, delete on public.report_credit_ledger to service_role;

revoke insert, update, delete on public.payment_webhook_events from authenticated;
revoke insert, update, delete on public.user_entitlements from authenticated;
revoke insert, update, delete on public.billing_audit_events from authenticated;
revoke insert, update, delete on public.report_credit_ledger from authenticated;

grant select on public.user_entitlements to authenticated;
grant select on public.billing_audit_events to authenticated;
grant select on public.report_credit_ledger to authenticated;

drop policy if exists "Users can read own entitlements" on public.user_entitlements;
create policy "Users can read own entitlements"
on public.user_entitlements
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own billing audit target events" on public.billing_audit_events;
create policy "Users can read own billing audit target events"
on public.billing_audit_events
for select
to authenticated
using (auth.uid() = target_user_id);

drop policy if exists "Users can read own report credit ledger" on public.report_credit_ledger;
create policy "Users can read own report credit ledger"
on public.report_credit_ledger
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_report_credit_balance(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.report_credit_ledger
  where user_id = target_user_id;
$$;

create or replace function public.consume_report_credit(
  target_user_id uuid,
  target_assessment_id uuid default null,
  target_client_id uuid default null,
  consume_metadata jsonb default '{}'::jsonb
)
returns table(ok boolean, remaining integer, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if target_user_id is null then
    ok := false;
    remaining := 0;
    error := 'user_required';
    return next;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(target_user_id::text)::bigint);

  if target_assessment_id is not null and exists (
    select 1
    from public.report_credit_ledger
    where user_id = target_user_id
      and assessment_id = target_assessment_id
      and reason = 'ai_report_consumed'
  ) then
    current_balance := public.get_report_credit_balance(target_user_id);
    ok := true;
    remaining := current_balance;
    error := null;
    return next;
    return;
  end if;

  current_balance := public.get_report_credit_balance(target_user_id);
  if current_balance < 1 then
    ok := false;
    remaining := current_balance;
    error := 'report_credit_required';
    return next;
    return;
  end if;

  insert into public.report_credit_ledger (
    user_id,
    delta,
    reason,
    source,
    assessment_id,
    client_id,
    metadata
  )
  values (
    target_user_id,
    -1,
    'ai_report_consumed',
    'system',
    target_assessment_id,
    target_client_id,
    coalesce(consume_metadata, '{}'::jsonb)
  );

  ok := true;
  remaining := current_balance - 1;
  error := null;
  return next;
end;
$$;

revoke all on function public.get_report_credit_balance(uuid) from public;
revoke all on function public.consume_report_credit(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.get_report_credit_balance(uuid) to service_role;
grant execute on function public.consume_report_credit(uuid, uuid, uuid, jsonb) to service_role;

-- Defense-in-depth: users may create only a free/default profile directly.
-- Paid plan changes must happen through server-side payment/admin flows.
drop policy if exists "Users can create own default profile" on public.profiles;
create policy "Users can create own default profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and coalesce(role, 'expert') = 'expert'
  and coalesce(plan, 'none') = 'none'
);
