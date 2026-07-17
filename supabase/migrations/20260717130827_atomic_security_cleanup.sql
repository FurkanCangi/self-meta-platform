-- Supabase history version: 20260717130827.
-- Atomic session/device revocation across custom sessions and education playback.
-- All callers are server-side service-role APIs.

begin;

create or replace function public.logout_account_security(
  p_user_id uuid,
  p_app_session_id uuid default null,
  p_global boolean default false,
  p_reason text default 'logout'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_device_ids uuid[] := array[]::uuid[];
  v_session_count integer := 0;
begin
  if p_user_id is null or (not p_global and p_app_session_id is null) then
    return jsonb_build_object('ok', false, 'error', 'logout_input_invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select coalesce(array_agg(distinct app_session.device_id), array[]::uuid[])
  into v_device_ids
  from public.account_sessions app_session
  where app_session.user_id = p_user_id
    and app_session.status = 'active'
    and (p_global or app_session.id = p_app_session_id);

  if not p_global and coalesce(array_length(v_device_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'alreadySignedOut', true, 'sessionCount', 0);
  end if;

  update public.account_sessions
  set status = 'signed_out', revoked_at = v_now
  where user_id = p_user_id
    and status = 'active'
    and (p_global or id = p_app_session_id);
  get diagnostics v_session_count = row_count;

  -- Playback mutators use the same advisory lock and lease -> token -> session
  -- order, so a concurrent takeover cannot survive this transaction.
  delete from public.education_video_playback_leases
  where user_id = p_user_id
    and (p_global or device_id = any(v_device_ids));

  update public.education_video_access_tokens
  set revoked_at = coalesce(revoked_at, v_now)
  where user_id = p_user_id
    and revoked_at is null
    and (p_global or device_id = any(v_device_ids));

  update public.education_video_playback_sessions
  set ended_at = coalesce(ended_at, v_now),
      ended_reason = coalesce(ended_reason, left(coalesce(p_reason, 'logout'), 80)),
      updated_at = v_now
  where user_id = p_user_id
    and ended_at is null
    and (p_global or device_id = any(v_device_ids));

  update public.account_devices
  set verification_required = true, verified_at = null
  where user_id = p_user_id
    and verification_method = 'legacy_session'
    and id = any(v_device_ids);

  return jsonb_build_object(
    'ok', true,
    'sessionCount', v_session_count,
    'deviceCount', coalesce(array_length(v_device_ids, 1), 0)
  );
end;
$$;

revoke all on function public.logout_account_security(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.logout_account_security(uuid, uuid, boolean, text)
  to service_role;

create or replace function public.revoke_account_device_security(
  p_user_id uuid,
  p_device_id uuid,
  p_reason text default 'device_removed',
  p_suspend_account boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_device_id is null then
    return jsonb_build_object('ok', false, 'error', 'device_revoke_input_invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if not exists (
    select 1 from public.account_devices
    where id = p_device_id and user_id = p_user_id
    for update
  ) then
    return jsonb_build_object('ok', false, 'error', 'device_not_found');
  end if;

  update public.account_devices
  set revoked_at = coalesce(revoked_at, v_now),
      verification_required = true,
      verified_at = null
  where id = p_device_id and user_id = p_user_id;

  if p_suspend_account then
    insert into public.account_security_state (
      user_id, manual_review_required, suspended_at, updated_at
    ) values (
      p_user_id, true, v_now, v_now
    )
    on conflict (user_id) do update set
      manual_review_required = true,
      suspended_at = v_now,
      updated_at = v_now;
  end if;

  update public.account_sessions
  set status = 'revoked', revoked_at = v_now
  where user_id = p_user_id
    and status = 'active'
    and (p_suspend_account or device_id = p_device_id);

  update public.account_device_verification_challenges
  set status = 'rejected', rejected_at = coalesce(rejected_at, v_now)
  where user_id = p_user_id
    and status = 'pending'
    and (p_suspend_account or pending_device_id = p_device_id);

  delete from public.education_video_playback_leases
  where user_id = p_user_id
    and (p_suspend_account or device_id = p_device_id);

  update public.education_video_access_tokens
  set revoked_at = coalesce(revoked_at, v_now)
  where user_id = p_user_id
    and revoked_at is null
    and (p_suspend_account or device_id = p_device_id);

  update public.education_video_playback_sessions
  set ended_at = coalesce(ended_at, v_now),
      ended_reason = coalesce(ended_reason, left(coalesce(p_reason, 'device_removed'), 80)),
      updated_at = v_now
  where user_id = p_user_id
    and ended_at is null
    and (p_suspend_account or device_id = p_device_id);

  return jsonb_build_object('ok', true, 'accountSuspended', p_suspend_account);
end;
$$;

revoke all on function public.revoke_account_device_security(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.revoke_account_device_security(uuid, uuid, text, boolean)
  to service_role;

commit;
