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
create policy "Users can read own account devices" on public.account_devices for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read own account sessions" on public.account_sessions;
create policy "Users can read own account sessions" on public.account_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read own account security events" on public.account_security_events;
create policy "Users can read own account security events" on public.account_security_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read own account security state" on public.account_security_state;
create policy "Users can read own account security state" on public.account_security_state for select to authenticated using (auth.uid() = user_id);
