-- Supabase history version: 20260717131530.
begin;

alter table public.account_devices enable row level security;
alter table public.account_sessions enable row level security;
alter table public.account_security_events enable row level security;
alter table public.account_security_state enable row level security;
alter table public.education_video_playback_sessions enable row level security;
alter table public.education_video_access_logs enable row level security;

drop policy if exists "Users can read own account devices" on public.account_devices;
drop policy if exists "Users can read own account sessions" on public.account_sessions;
drop policy if exists "Users can read own account security events" on public.account_security_events;
drop policy if exists "Users can read own account security state" on public.account_security_state;
drop policy if exists "Users can read own education video playback sessions" on public.education_video_playback_sessions;
drop policy if exists "Users can read own education video logs" on public.education_video_access_logs;

revoke all privileges on table public.account_devices from public, anon, authenticated;
revoke all privileges on table public.account_sessions from public, anon, authenticated;
revoke all privileges on table public.account_security_events from public, anon, authenticated;
revoke all privileges on table public.account_security_state from public, anon, authenticated;
revoke all privileges on table public.education_video_playback_sessions from public, anon, authenticated;
revoke all privileges on table public.education_video_access_logs from public, anon, authenticated;

grant all privileges on table public.account_devices to service_role;
grant all privileges on table public.account_sessions to service_role;
grant all privileges on table public.account_security_events to service_role;
grant all privileges on table public.account_security_state to service_role;
grant all privileges on table public.education_video_playback_sessions to service_role;
grant all privileges on table public.education_video_access_logs to service_role;

-- These surfaces are served exclusively through authenticated server APIs.
-- Removing direct browser grants keeps raw billing, legal, support, privacy,
-- notification and education-security rows inaccessible to a copied JWT.
revoke all privileges on table public.legal_acceptances from public, anon, authenticated;
revoke all privileges on table public.user_entitlements from public, anon, authenticated;
revoke all privileges on table public.billing_audit_events from public, anon, authenticated;
revoke all privileges on table public.report_credit_ledger from public, anon, authenticated;
revoke all privileges on table public.support_tickets from public, anon, authenticated;
revoke all privileges on table public.support_ticket_messages from public, anon, authenticated;
revoke all privileges on table public.support_ticket_attachments from public, anon, authenticated;
revoke all privileges on table public.privacy_data_requests from public, anon, authenticated;
revoke all privileges on table public.data_access_audit_events from public, anon, authenticated;
revoke all privileges on table public.notification_reads from public, anon, authenticated;
revoke all privileges on table public.notifications from public, anon, authenticated;
revoke all privileges on table public.therapist_directory_profiles from public, anon, authenticated;
revoke all privileges on table public.education_video_assets from public, anon, authenticated;
revoke all privileges on table public.education_video_access_tokens from public, anon, authenticated;

grant all privileges on table public.legal_acceptances to service_role;
grant all privileges on table public.user_entitlements to service_role;
grant all privileges on table public.billing_audit_events to service_role;
grant all privileges on table public.report_credit_ledger to service_role;
grant all privileges on table public.support_tickets to service_role;
grant all privileges on table public.support_ticket_messages to service_role;
grant all privileges on table public.support_ticket_attachments to service_role;
grant all privileges on table public.privacy_data_requests to service_role;
grant all privileges on table public.data_access_audit_events to service_role;
grant all privileges on table public.notification_reads to service_role;
grant all privileges on table public.notifications to service_role;
grant all privileges on table public.therapist_directory_profiles to service_role;
grant all privileges on table public.education_video_assets to service_role;
grant all privileges on table public.education_video_access_tokens to service_role;

create or replace function public.has_trusted_app_session()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    auth.uid() is not null
    and not exists (
      select 1
      from public.account_security_state security_state
      where security_state.user_id = auth.uid()
        and (
          security_state.suspended_at is not null
          or security_state.temporary_locked_until > now()
        )
    )
    and exists (
      select 1
      from public.account_sessions app_session
      join public.account_devices device
        on device.id = app_session.device_id
       and device.user_id = app_session.user_id
      where app_session.user_id = auth.uid()
        and app_session.auth_session_id::text = coalesce(auth.jwt() ->> 'session_id', '')
        and app_session.status = 'active'
        and app_session.expires_at > now()
        and device.revoked_at is null
        and device.verification_required = false
        and device.verified_at is not null
    );
$$;

revoke all on function public.has_trusted_app_session() from public, anon;
grant execute on function public.has_trusted_app_session() to authenticated, service_role;

drop policy if exists "Trusted app session required for profiles" on public.profiles;
create policy "Trusted app session required for profiles"
on public.profiles as restrictive
for all to authenticated
using (public.has_trusted_app_session())
with check (public.has_trusted_app_session());

drop policy if exists "Trusted app session required for clients" on public.clients;
create policy "Trusted app session required for clients"
on public.clients as restrictive
for all to authenticated
using (public.has_trusted_app_session())
with check (public.has_trusted_app_session());

drop policy if exists "Trusted app session required for assessments" on public.assessments_v2;
create policy "Trusted app session required for assessments"
on public.assessments_v2 as restrictive
for all to authenticated
using (public.has_trusted_app_session())
with check (public.has_trusted_app_session());

drop policy if exists "Trusted app session required for reports" on public.reports;
create policy "Trusted app session required for reports"
on public.reports as restrictive
for all to authenticated
using (public.has_trusted_app_session())
with check (public.has_trusted_app_session());

commit;
