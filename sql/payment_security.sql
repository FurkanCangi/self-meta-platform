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

alter table public.payment_webhook_events enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.billing_audit_events enable row level security;

revoke all on public.payment_webhook_events from anon;
revoke all on public.user_entitlements from anon;
revoke all on public.billing_audit_events from anon;

revoke insert, update, delete on public.payment_webhook_events from authenticated;
revoke insert, update, delete on public.user_entitlements from authenticated;
revoke insert, update, delete on public.billing_audit_events from authenticated;

grant select on public.user_entitlements to authenticated;
grant select on public.billing_audit_events to authenticated;

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
