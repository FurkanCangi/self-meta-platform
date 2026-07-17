-- Supabase history version: 20260717111042.
-- Cover foreign keys introduced by the device-trust and single-playback
-- migrations. These indexes keep deletes and owner cleanup predictable as the
-- audit history grows.

begin;

create index if not exists account_device_changes_device_idx
  on public.account_device_changes (device_id)
  where device_id is not null;

create index if not exists account_device_changes_actor_idx
  on public.account_device_changes (actor_user_id)
  where actor_user_id is not null;

create index if not exists account_device_proof_nonces_user_idx
  on public.account_device_proof_nonces (user_id);

create index if not exists account_device_challenges_approver_idx
  on public.account_device_verification_challenges (approved_by_device_id)
  where approved_by_device_id is not null;

create index if not exists education_video_playback_leases_video_idx
  on public.education_video_playback_leases (video_id);

create index if not exists education_video_playback_leases_token_idx
  on public.education_video_playback_leases (token_id);

create index if not exists education_video_playback_leases_app_session_idx
  on public.education_video_playback_leases (app_session_id);

create index if not exists education_video_playback_leases_device_idx
  on public.education_video_playback_leases (device_id);

commit;
