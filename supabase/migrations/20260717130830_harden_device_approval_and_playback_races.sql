-- Supabase history version: 20260717130830.
-- Live delta for installations that already applied the base device/video migrations.
-- Fresh databases receive the same definitions from the original versioned files.

begin;

create or replace function public.approve_account_device_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_code_hash text,
  p_approver_device_id uuid
)
returns table(result text, approved_device_id uuid)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  challenge_row public.account_device_verification_challenges%rowtype;
  active_device_count integer;
  verified_device_history_count integer;
  replacement_count integer;
  replacement_required boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if not exists (
    select 1
    from public.account_devices
    where id = p_approver_device_id
      and user_id = p_user_id
      and revoked_at is null
      and verification_required = false
      and verified_at is not null
  ) then
    return query select 'approver_not_trusted'::text, null::uuid;
    return;
  end if;

  select * into challenge_row
  from public.account_device_verification_challenges
  where id = p_challenge_id and user_id = p_user_id
  for update;

  if not found then
    return query select 'challenge_not_found'::text, null::uuid;
    return;
  end if;

  if challenge_row.status <> 'pending' then
    return query select challenge_row.status, challenge_row.pending_device_id;
    return;
  end if;

  if challenge_row.expires_at <= now() then
    update public.account_device_verification_challenges
    set status = 'expired'
    where id = challenge_row.id;
    update public.account_devices
    set revoked_at = coalesce(revoked_at, now()), verification_required = true, verified_at = null
    where id = challenge_row.pending_device_id
      and user_id = p_user_id
      and ever_verified_at is null;
    return query select 'expired'::text, challenge_row.pending_device_id;
    return;
  end if;

  if challenge_row.code_hash <> p_code_hash then
    update public.account_device_verification_challenges
    set
      attempts = least(attempts + 1, max_attempts),
      status = case when attempts + 1 >= max_attempts then 'attempts_exhausted' else status end
    where id = challenge_row.id;
    if challenge_row.attempts + 1 >= challenge_row.max_attempts then
      update public.account_devices
      set revoked_at = coalesce(revoked_at, now()), verification_required = true, verified_at = null
      where id = challenge_row.pending_device_id
        and user_id = p_user_id
        and ever_verified_at is null;
    end if;
    return query select
      case when challenge_row.attempts + 1 >= challenge_row.max_attempts
        then 'attempts_exhausted'::text else 'invalid_code'::text end,
      challenge_row.pending_device_id;
    return;
  end if;

  if not exists (
    select 1
    from public.account_devices pending_device
    where pending_device.id = challenge_row.pending_device_id
      and pending_device.user_id = p_user_id
    for update
  ) then
    return query select 'device_not_found'::text, challenge_row.pending_device_id;
    return;
  end if;

  select count(*) into active_device_count
  from public.account_devices
  where user_id = p_user_id
    and revoked_at is null
    and verification_required = false
    and verified_at is not null;

  if active_device_count >= 3 then
    update public.account_device_verification_challenges
    set status = 'device_limit'
    where id = challenge_row.id;
    update public.account_devices
    set revoked_at = coalesce(revoked_at, now()), verification_required = true, verified_at = null
    where id = challenge_row.pending_device_id
      and user_id = p_user_id
      and ever_verified_at is null;
    return query select 'device_limit'::text, challenge_row.pending_device_id;
    return;
  end if;

  -- Decide quota usage at approval time while the per-user advisory lock is
  -- held. A challenge may have been queued before another pending device became
  -- the third ever-verified device, so the request-time hint is not authoritative.
  select count(*) into verified_device_history_count
  from public.account_devices history_device
  where history_device.user_id = p_user_id
    and history_device.ever_verified_at is not null;

  replacement_required := verified_device_history_count >= 3;

  if replacement_required then
    select count(*) into replacement_count
    from public.account_device_changes replacement_row
    where replacement_row.user_id = p_user_id
      and replacement_row.action = 'replacement_approved'
      and replacement_row.created_at > now() - interval '30 days'
      and not exists (
        select 1
        from public.account_device_changes reset_row
        where reset_row.user_id = p_user_id
          and reset_row.action in ('owner_replacement_reset', 'owner_all_lost_reset')
          and reset_row.created_at > replacement_row.created_at
      );

    if replacement_count >= 2 then
      update public.account_device_verification_challenges
      set
        status = 'replacement_limit',
        counts_as_replacement = true
      where id = challenge_row.id;
      update public.account_devices
      set revoked_at = coalesce(revoked_at, now()), verification_required = true, verified_at = null
      where id = challenge_row.pending_device_id
        and user_id = p_user_id
        and ever_verified_at is null;
      return query select 'replacement_limit'::text, challenge_row.pending_device_id;
      return;
    end if;
  end if;

  update public.account_devices
  set
    verification_required = false,
    verified_at = now(),
    ever_verified_at = coalesce(ever_verified_at, now()),
    revoked_at = null,
    last_seen_at = now()
  where id = challenge_row.pending_device_id
    and user_id = p_user_id;

  update public.account_device_verification_challenges
  set
    status = 'approved',
    counts_as_replacement = replacement_required,
    approved_by_device_id = p_approver_device_id,
    approved_at = now()
  where id = challenge_row.id;

  if replacement_required then
    insert into public.account_device_changes (user_id, device_id, action, actor_user_id, reason)
    values (p_user_id, challenge_row.pending_device_id, 'replacement_approved', p_user_id, 'self_service_approval');
  end if;

  return query select 'approved'::text, challenge_row.pending_device_id;
end;
$$;

revoke all on function public.approve_account_device_challenge(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.approve_account_device_challenge(uuid, uuid, text, uuid) to service_role;

create or replace function public.claim_education_video_playback(
  p_user_id uuid,
  p_video_id uuid,
  p_token_id uuid,
  p_app_session_id uuid,
  p_device_id uuid,
  p_player_session_id text,
  p_force boolean default false,
  p_ttl_seconds integer default 90,
  p_watermark_code text default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_existing public.education_video_playback_leases%rowtype;
  v_existing_found boolean := false;
  v_new_lease_id uuid := gen_random_uuid();
  v_new_version bigint := 1;
  v_status text := 'claimed';
  v_device_type text := 'unknown';
begin
  if p_user_id is null
    or p_video_id is null
    or p_token_id is null
    or p_app_session_id is null
    or p_device_id is null
    or nullif(btrim(p_player_session_id), '') is null
    or char_length(p_player_session_id) > 120 then
    return jsonb_build_object('ok', false, 'error', 'playback_claim_invalid');
  end if;

  if p_ttl_seconds < 30 or p_ttl_seconds > 300 then
    return jsonb_build_object('ok', false, 'error', 'playback_ttl_invalid');
  end if;
  v_expires_at := v_now + make_interval(secs => p_ttl_seconds);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if not exists (
    select 1
    from public.account_sessions s
    where s.id = p_app_session_id
      and s.user_id = p_user_id
      and s.device_id = p_device_id
      and s.status = 'active'
      and s.expires_at > v_now
  ) then
    return jsonb_build_object('ok', false, 'error', 'app_session_invalid');
  end if;

  select coalesce(d.device_type, 'unknown')
  into v_device_type
  from public.account_devices d
  where d.id = p_device_id
    and d.user_id = p_user_id
    and d.revoked_at is null
    and d.verification_required = false
    and d.verified_at is not null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'device_not_verified');
  end if;

  if not exists (
    select 1
    from public.education_video_access_tokens t
    where t.id = p_token_id
      and t.user_id = p_user_id
      and t.video_id = p_video_id
      and t.app_session_id = p_app_session_id
      and t.device_id = p_device_id
      and t.player_session_id = p_player_session_id
      and t.revoked_at is null
      and t.expires_at > v_now
  ) then
    return jsonb_build_object('ok', false, 'error', 'access_token_invalid');
  end if;

  select *
  into v_existing
  from public.education_video_playback_leases l
  where l.user_id = p_user_id;
  v_existing_found := found;

  if v_existing_found and v_existing.expires_at > v_now then
    if v_existing.device_id <> p_device_id and not p_force then
      select coalesce(d.device_type, 'unknown')
      into v_device_type
      from public.account_devices d
      where d.id = v_existing.device_id;

      return jsonb_build_object(
        'ok', false,
        'error', 'active_playback_exists',
        'activePlayback', jsonb_build_object(
          'videoId', v_existing.video_id,
          'deviceId', v_existing.device_id,
          'deviceType', coalesce(v_device_type, 'unknown'),
          'lastHeartbeatAt', v_existing.last_heartbeat_at,
          'expiresAt', v_existing.expires_at
        )
      );
    end if;

    if v_existing.device_id = p_device_id then
      if v_existing.video_id = p_video_id
        and v_existing.player_session_id = p_player_session_id then
        v_status := 'renewed';
      else
        v_status := 'same_device_switched';
      end if;
    else
      v_status := 'taken_over';
    end if;
  elsif v_existing_found then
    v_status := 'expired_reclaimed';
  end if;

  if v_existing_found then
    v_new_version := v_existing.lease_version + 1;
  end if;

  -- Every lease mutator takes the same per-user advisory lock and changes rows
  -- in lease -> token -> playback-session order. This prevents a takeover from
  -- deadlocking with a concurrent heartbeat or release.
  insert into public.education_video_playback_leases (
    user_id,
    lease_id,
    video_id,
    token_id,
    app_session_id,
    device_id,
    player_session_id,
    lease_version,
    acquired_at,
    last_heartbeat_at,
    expires_at,
    updated_at
  ) values (
    p_user_id,
    v_new_lease_id,
    p_video_id,
    p_token_id,
    p_app_session_id,
    p_device_id,
    p_player_session_id,
    v_new_version,
    v_now,
    v_now,
    v_expires_at,
    v_now
  )
  on conflict (user_id) do update set
    lease_id = excluded.lease_id,
    video_id = excluded.video_id,
    token_id = excluded.token_id,
    app_session_id = excluded.app_session_id,
    device_id = excluded.device_id,
    player_session_id = excluded.player_session_id,
    lease_version = excluded.lease_version,
    acquired_at = excluded.acquired_at,
    last_heartbeat_at = excluded.last_heartbeat_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at;

  if v_existing_found then
    update public.education_video_access_tokens
    set revoked_at = coalesce(revoked_at, v_now)
    where id = v_existing.token_id
      and id <> p_token_id;

    update public.education_video_playback_sessions
    set ended_at = coalesce(ended_at, v_now),
        ended_reason = coalesce(ended_reason, v_status),
        updated_at = v_now
    where user_id = p_user_id
      and ended_at is null
      and lease_id = v_existing.lease_id;
  end if;

  insert into public.education_video_playback_sessions (
    user_id,
    video_id,
    token_id,
    player_session_id,
    last_heartbeat_at,
    ended_at,
    ip_address,
    user_agent,
    watermark_code,
    updated_at,
    lease_id,
    app_session_id,
    device_id,
    ended_reason
  ) values (
    p_user_id,
    p_video_id,
    p_token_id,
    p_player_session_id,
    v_now,
    null,
    nullif(left(coalesce(p_ip_address, ''), 120), ''),
    nullif(left(coalesce(p_user_agent, ''), 500), ''),
    nullif(left(coalesce(p_watermark_code, ''), 160), ''),
    v_now,
    v_new_lease_id,
    p_app_session_id,
    p_device_id,
    null
  )
  on conflict (user_id, video_id, player_session_id) do update set
    token_id = excluded.token_id,
    last_heartbeat_at = excluded.last_heartbeat_at,
    ended_at = null,
    ip_address = excluded.ip_address,
    user_agent = excluded.user_agent,
    watermark_code = excluded.watermark_code,
    updated_at = excluded.updated_at,
    lease_id = excluded.lease_id,
    app_session_id = excluded.app_session_id,
    device_id = excluded.device_id,
    ended_reason = null;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'leaseId', v_new_lease_id,
    'leaseVersion', v_new_version,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.touch_education_video_playback(
  p_user_id uuid,
  p_video_id uuid,
  p_token_id uuid,
  p_lease_id uuid,
  p_app_session_id uuid,
  p_device_id uuid,
  p_player_session_id text,
  p_ttl_seconds integer default 90
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_version bigint;
begin
  if p_ttl_seconds < 30 or p_ttl_seconds > 300 then
    return jsonb_build_object('ok', false, 'error', 'playback_ttl_invalid');
  end if;
  v_expires_at := v_now + make_interval(secs => p_ttl_seconds);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  update public.education_video_playback_leases
  set last_heartbeat_at = v_now,
      expires_at = v_expires_at,
      updated_at = v_now
  where user_id = p_user_id
    and video_id = p_video_id
    and token_id = p_token_id
    and lease_id = p_lease_id
    and app_session_id = p_app_session_id
    and device_id = p_device_id
    and player_session_id = p_player_session_id
    and expires_at > v_now
    and exists (
      select 1
      from public.account_sessions s
      where s.id = p_app_session_id
        and s.user_id = p_user_id
        and s.device_id = p_device_id
        and s.status = 'active'
        and s.expires_at > v_now
    )
    and exists (
      select 1
      from public.account_devices d
      where d.id = p_device_id
        and d.user_id = p_user_id
        and d.revoked_at is null
        and d.verification_required = false
        and d.verified_at is not null
    )
    and exists (
      select 1
      from public.education_video_access_tokens t
      where t.id = p_token_id
        and t.user_id = p_user_id
        and t.video_id = p_video_id
        and t.revoked_at is null
        and t.expires_at > v_now
    )
  returning lease_version into v_version;

  if not found then
    update public.education_video_playback_sessions
    set ended_at = coalesce(ended_at, v_now),
        ended_reason = coalesce(ended_reason, 'playback_lease_lost'),
        updated_at = v_now
    where user_id = p_user_id
      and lease_id = p_lease_id
      and ended_at is null;

    return jsonb_build_object('ok', false, 'error', 'playback_lease_lost');
  end if;

  -- Access tokens start short-lived, then remain valid only while the exact
  -- account/device/player lease keeps sending accepted heartbeats.
  update public.education_video_access_tokens
  set expires_at = v_now + interval '5 minutes',
      used_at = v_now
  where id = p_token_id
    and user_id = p_user_id
    and video_id = p_video_id
    and revoked_at is null;

  update public.education_video_playback_sessions
  set last_heartbeat_at = v_now,
      updated_at = v_now
  where user_id = p_user_id
    and lease_id = p_lease_id
    and ended_at is null;

  return jsonb_build_object(
    'ok', true,
    'leaseVersion', v_version,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.release_education_video_playback(
  p_user_id uuid,
  p_token_id uuid,
  p_lease_id uuid,
  p_app_session_id uuid,
  p_device_id uuid,
  p_player_session_id text,
  p_reason text default 'released'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_released uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  delete from public.education_video_playback_leases
  where user_id = p_user_id
    and token_id = p_token_id
    and lease_id = p_lease_id
    and app_session_id = p_app_session_id
    and device_id = p_device_id
    and player_session_id = p_player_session_id
  returning lease_id into v_released;

  update public.education_video_access_tokens
  set revoked_at = coalesce(revoked_at, v_now)
  where id = p_token_id
    and user_id = p_user_id;

  update public.education_video_playback_sessions
  set ended_at = coalesce(ended_at, v_now),
      ended_reason = coalesce(ended_reason, left(coalesce(nullif(p_reason, ''), 'released'), 80)),
      updated_at = v_now
  where user_id = p_user_id
    and lease_id = p_lease_id
    and ended_at is null;

  return jsonb_build_object('ok', true, 'released', v_released is not null);
end;
$$;

create or replace function public.release_education_playback_for_device(
  p_user_id uuid,
  p_device_id uuid,
  p_reason text default 'device_revoked'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lease_id uuid;
  v_token_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select lease_id, token_id
  into v_lease_id, v_token_id
  from public.education_video_playback_leases
  where user_id = p_user_id
    and device_id = p_device_id;

  delete from public.education_video_playback_leases
  where user_id = p_user_id
    and device_id = p_device_id;

  update public.education_video_access_tokens
  set revoked_at = coalesce(revoked_at, v_now)
  where user_id = p_user_id
    and device_id = p_device_id
    and revoked_at is null;

  update public.education_video_playback_sessions
  set ended_at = coalesce(ended_at, v_now),
      ended_reason = coalesce(ended_reason, left(coalesce(nullif(p_reason, ''), 'device_revoked'), 80)),
      updated_at = v_now
  where user_id = p_user_id
    and device_id = p_device_id
    and ended_at is null;

  return jsonb_build_object(
    'ok', true,
    'released', v_lease_id is not null,
    'leaseId', v_lease_id,
    'tokenId', v_token_id
  );
end;
$$;

revoke all on function public.claim_education_video_playback(uuid, uuid, uuid, uuid, uuid, text, boolean, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.touch_education_video_playback(uuid, uuid, uuid, uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_education_video_playback(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_education_playback_for_device(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_education_video_playback(uuid, uuid, uuid, uuid, uuid, text, boolean, integer, text, text, text) to service_role;
grant execute on function public.touch_education_video_playback(uuid, uuid, uuid, uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.release_education_video_playback(uuid, uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.release_education_playback_for_device(uuid, uuid, text) to service_role;

commit;
