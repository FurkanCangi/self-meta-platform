-- Supabase history version: 20260717110912.
-- Device trust, approval, replacement quotas, and per-device app sessions.
-- Additive/idempotent so it can be applied after sql/account_session_policy.sql.

begin;

alter table if exists public.account_devices
  add column if not exists display_name text null,
  add column if not exists public_key_jwk jsonb null,
  add column if not exists public_key_fingerprint text null,
  add column if not exists verification_method text not null default 'legacy_transition',
  add column if not exists legacy_transition_until timestamptz null,
  add column if not exists ever_verified_at timestamptz null,
  add column if not exists last_city text null,
  add column if not exists last_country text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_devices_verification_method_check'
      and conrelid = 'public.account_devices'::regclass
  ) then
    alter table public.account_devices
      add constraint account_devices_verification_method_check
      check (verification_method in ('p256_v1', 'legacy_transition', 'legacy_session'));
  end if;
end $$;

create unique index if not exists account_devices_user_public_key_idx
  on public.account_devices (user_id, public_key_fingerprint)
  where public_key_fingerprint is not null;

create table if not exists public.account_device_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pending_device_id uuid not null references public.account_devices(id) on delete cascade,
  code_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'attempts_exhausted', 'device_limit', 'replacement_limit')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  counts_as_replacement boolean not null default false,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_by_device_id uuid null references public.account_devices(id) on delete set null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  consumed_at timestamptz null
);

create index if not exists account_device_challenges_user_status_idx
  on public.account_device_verification_challenges (user_id, status, requested_at desc);
create index if not exists account_device_challenges_pending_device_idx
  on public.account_device_verification_challenges (pending_device_id, requested_at desc);

create unique index if not exists account_device_one_pending_challenge_idx
  on public.account_device_verification_challenges (pending_device_id)
  where status = 'pending';

create table if not exists public.account_device_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid null references public.account_devices(id) on delete set null,
  action text not null
    check (action in ('replacement_approved', 'owner_replacement_reset', 'owner_all_lost_reset')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_device_changes_replacement_idx
  on public.account_device_changes (user_id, action, created_at desc);

create table if not exists public.account_device_proof_nonces (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_fingerprint text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);

create index if not exists account_device_proof_nonces_expiry_idx
  on public.account_device_proof_nonces (expires_at);

alter table public.account_device_verification_challenges enable row level security;
alter table public.account_device_changes enable row level security;
alter table public.account_device_proof_nonces enable row level security;

revoke all on table public.account_device_verification_challenges from public, anon, authenticated;
revoke all on table public.account_device_changes from public, anon, authenticated;
revoke all on table public.account_device_proof_nonces from public, anon, authenticated;
grant all on table public.account_device_verification_challenges to service_role;
grant all on table public.account_device_changes to service_role;
grant all on table public.account_device_proof_nonces to service_role;
grant usage, select on sequence public.account_device_changes_id_seq to service_role;

-- Existing installations may already contain several active devices. Preserve the
-- three most recently used ones and retire older rows without deleting history.
update public.account_devices
set ever_verified_at = coalesce(ever_verified_at, verified_at, last_seen_at, first_seen_at)
where ever_verified_at is null;

with ranked_devices as (
  select
    id,
    row_number() over (
      partition by user_id
      order by last_seen_at desc nulls last, first_seen_at desc, id
    ) as device_rank
  from public.account_devices
  where revoked_at is null
)
update public.account_devices d
set
  verification_required = case when ranked_devices.device_rank <= 3 then false else true end,
  verified_at = case
    when ranked_devices.device_rank <= 3 then coalesce(d.verified_at, d.last_seen_at, now())
    else null
  end,
  ever_verified_at = coalesce(d.ever_verified_at, d.verified_at, d.last_seen_at, d.first_seen_at),
  verification_method = case
    when d.public_key_fingerprint is not null then 'p256_v1'
    else 'legacy_transition'
  end,
  legacy_transition_until = case
    when d.public_key_fingerprint is null and ranked_devices.device_rank <= 3
      then coalesce(d.legacy_transition_until, now() + interval '30 days')
    else d.legacy_transition_until
  end,
  revoked_at = case
    when ranked_devices.device_rank > 3 then coalesce(d.revoked_at, now())
    else d.revoked_at
  end
from ranked_devices
where d.id = ranked_devices.id;

-- One custom app session per device, while three different devices can remain
-- active. Collapse pre-existing duplicates before installing the unique index.
with ranked_sessions as (
  select
    id,
    first_value(id) over (
      partition by user_id, device_id
      order by created_at desc, id desc
    ) as newest_session_id,
    row_number() over (
      partition by user_id, device_id
      order by created_at desc, id desc
    ) as session_rank
  from public.account_sessions
  where status = 'active'
)
update public.account_sessions s
set
  status = 'replaced',
  revoked_at = coalesce(s.revoked_at, now()),
  replaced_by_session_id = ranked_sessions.newest_session_id
from ranked_sessions
where s.id = ranked_sessions.id
  and ranked_sessions.session_rank > 1;

update public.account_sessions s
set status = 'revoked', revoked_at = coalesce(s.revoked_at, now())
from public.account_devices d
where s.device_id = d.id
  and s.status = 'active'
  and (d.revoked_at is not null or d.verification_required or d.verified_at is null);

create unique index if not exists account_sessions_one_active_per_device_idx
  on public.account_sessions (user_id, device_id)
  where status = 'active';

-- Hard database invariant for concurrent registrations. The application checks
-- first for a friendly response; this lock/trigger closes the race between two
-- different server instances attempting to occupy the third slot.
create or replace function public.enforce_account_device_active_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  occupied_count integer;
  trusted_count integer;
begin
  if new.revoked_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into occupied_count
  from public.account_devices existing
  where existing.user_id = new.user_id
    and existing.revoked_at is null
    and existing.id <> new.id;

  if tg_op = 'INSERT' and new.verification_required = false and new.verified_at is not null then
    select count(*) into trusted_count
    from public.account_devices existing
    where existing.user_id = new.user_id
      and existing.revoked_at is null
      and existing.verification_required = false
      and existing.verified_at is not null;
    if trusted_count >= 1 then
      raise exception using
        errcode = 'P0001',
        message = 'additional_device_requires_approval';
    end if;
  end if;

  if occupied_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'device_limit_exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists account_devices_active_limit_trigger on public.account_devices;
create trigger account_devices_active_limit_trigger
before insert or update of revoked_at, user_id
on public.account_devices
for each row
execute function public.enforce_account_device_active_limit();

revoke all on function public.enforce_account_device_active_limit() from public, anon, authenticated;
grant execute on function public.enforce_account_device_active_limit() to service_role;

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

commit;
