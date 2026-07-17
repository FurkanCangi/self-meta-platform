-- Supabase history version: 20260717132102.
-- Remove obsolete browser policies from server-only tables and cover the
-- foreign keys exercised by device revocation and playback cleanup.

begin;

drop policy if exists "Users can read own legal acceptances" on public.legal_acceptances;
drop policy if exists "Users can read own entitlements" on public.user_entitlements;
drop policy if exists "Users can read own billing audit target events" on public.billing_audit_events;
drop policy if exists "Users can read own report credit ledger" on public.report_credit_ledger;
drop policy if exists "Users can create own support tickets" on public.support_tickets;
drop policy if exists "Users can read own support tickets" on public.support_tickets;
drop policy if exists "Users can create own support messages" on public.support_ticket_messages;
drop policy if exists "Users can read own support messages" on public.support_ticket_messages;
drop policy if exists "Users can read own support attachments" on public.support_ticket_attachments;
drop policy if exists "Users can read own privacy data requests" on public.privacy_data_requests;
drop policy if exists "Users can read own data access audit events" on public.data_access_audit_events;
drop policy if exists "Users can mark their notifications as read" on public.notification_reads;
drop policy if exists "Users can read their notification receipts" on public.notification_reads;
drop policy if exists "Users can update their notification receipts" on public.notification_reads;
drop policy if exists "Authenticated users can read published notifications" on public.notifications;
drop policy if exists "No direct anon therapist directory access" on public.therapist_directory_profiles;

create index if not exists account_security_events_device_idx
  on public.account_security_events (device_id)
  where device_id is not null;

create index if not exists education_video_access_logs_token_idx
  on public.education_video_access_logs (token_id)
  where token_id is not null;

create index if not exists education_video_access_tokens_video_idx
  on public.education_video_access_tokens (video_id);

create index if not exists education_video_playback_sessions_token_idx
  on public.education_video_playback_sessions (token_id);

create index if not exists education_video_playback_sessions_video_idx
  on public.education_video_playback_sessions (video_id);

commit;
