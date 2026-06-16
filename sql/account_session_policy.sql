-- Account device, app-session, and anomaly enforcement.
-- Apply before deploying the Phase 3/4 session and anomaly code.

create table if not exists public.account_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_fingerprint_hash text not null,
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  first_user_agent text null,
  last_user_agent text null,
  first_ip text null,
  last_ip text null,
  verification_required boolean not null default false,
  verified_at timestamptz null,
  unique (user_id, device_fingerprint_hash)
);

create index if not exists account_devices_user_active_idx
  on public.account_devices (user_id, revoked_at, last_seen_at desc);

create table if not exists public.account_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.account_devices(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'replaced', 'signed_out', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  replaced_by_session_id uuid null,
  ip_address text null,
  user_agent text null
);

create index if not exists account_sessions_user_status_idx
  on public.account_sessions (user_id, status, created_at desc);

create index if not exists account_sessions_device_idx
  on public.account_sessions (device_id, created_at desc);

create table if not exists public.account_security_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid null references public.account_devices(id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default now(),
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_security_events_user_idx
  on public.account_security_events (user_id, created_at desc);

create table if not exists public.account_security_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  risk_score integer not null default 0,
  risk_reasons jsonb not null default '[]'::jsonb,
  manual_review_required boolean not null default false,
  temporary_locked_until timestamptz null,
  suspended_at timestamptz null,
  last_evaluated_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists account_security_state_review_idx
  on public.account_security_state (manual_review_required, updated_at desc);

alter table public.account_devices enable row level security;
alter table public.account_sessions enable row level security;
alter table public.account_security_events enable row level security;
alter table public.account_security_state enable row level security;

revoke all on public.account_devices from anon;
revoke all on public.account_sessions from anon;
revoke all on public.account_security_events from anon;
revoke all on public.account_security_state from anon;
revoke insert, update, delete on public.account_devices from authenticated;
revoke insert, update, delete on public.account_sessions from authenticated;
revoke insert, update, delete on public.account_security_events from authenticated;
revoke insert, update, delete on public.account_security_state from authenticated;
grant select on public.account_devices to authenticated;
grant select on public.account_sessions to authenticated;
grant select on public.account_security_events to authenticated;
grant select on public.account_security_state to authenticated;

drop policy if exists "Users can read own account devices" on public.account_devices;
create policy "Users can read own account devices"
on public.account_devices
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own account sessions" on public.account_sessions;
create policy "Users can read own account sessions"
on public.account_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own account security events" on public.account_security_events;
create policy "Users can read own account security events"
on public.account_security_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own account security state" on public.account_security_state;
create policy "Users can read own account security state"
on public.account_security_state
for select
to authenticated
using (auth.uid() = user_id);
