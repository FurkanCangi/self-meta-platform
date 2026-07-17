-- Supabase history version: 20260717110915.
-- One active education-video playback lease per individual account.
-- All writes go through service-role-only SECURITY INVOKER RPCs.

begin;

alter table public.education_video_access_tokens
  add column if not exists app_session_id uuid null,
  add column if not exists device_id uuid null,
  add column if not exists player_session_id text null;

create index if not exists education_video_access_tokens_device_active_idx
  on public.education_video_access_tokens (user_id, device_id, expires_at desc)
  where revoked_at is null;

alter table public.education_video_playback_sessions
  add column if not exists lease_id uuid null,
  add column if not exists app_session_id uuid null,
  add column if not exists device_id uuid null,
  add column if not exists ended_reason text null;

create index if not exists education_video_playback_sessions_account_active_idx
  on public.education_video_playback_sessions (user_id, last_heartbeat_at desc)
  where ended_at is null;

create table if not exists public.education_video_playback_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease_id uuid not null unique default gen_random_uuid(),
  video_id uuid not null references public.education_video_assets(id) on delete cascade,
  token_id uuid not null references public.education_video_access_tokens(id) on delete cascade,
  app_session_id uuid not null references public.account_sessions(id) on delete cascade,
  device_id uuid not null references public.account_devices(id) on delete cascade,
  player_session_id text not null,
  lease_version bigint not null default 1,
  acquired_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint education_video_playback_lease_player_check
    check (char_length(player_session_id) between 1 and 120),
  constraint education_video_playback_lease_expiry_check
    check (expires_at > acquired_at)
);

create index if not exists education_video_playback_leases_expiry_idx
  on public.education_video_playback_leases (expires_at);

alter table public.education_video_playback_leases enable row level security;

revoke all on table public.education_video_playback_leases from public, anon, authenticated;
grant select, insert, update, delete on table public.education_video_playback_leases to service_role;

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
