-- Supabase history version: 20260717153624.
-- Idempotent live reconciliation recorded after the access regression was
-- detected. Kept in source so the repository matches Supabase migration
-- history exactly.

alter table public.account_devices enable row level security;
alter table public.account_sessions enable row level security;
alter table public.account_security_events enable row level security;
alter table public.account_security_state enable row level security;

drop policy if exists "Users can read own account devices" on public.account_devices;
drop policy if exists "Users can read own account sessions" on public.account_sessions;
drop policy if exists "Users can read own account security events" on public.account_security_events;
drop policy if exists "Users can read own account security state" on public.account_security_state;

revoke all privileges on table public.account_devices from public, anon, authenticated;
revoke all privileges on table public.account_sessions from public, anon, authenticated;
revoke all privileges on table public.account_security_events from public, anon, authenticated;
revoke all privileges on table public.account_security_state from public, anon, authenticated;

grant all privileges on table public.account_devices to service_role;
grant all privileges on table public.account_sessions to service_role;
grant all privileges on table public.account_security_events to service_role;
grant all privileges on table public.account_security_state to service_role;
