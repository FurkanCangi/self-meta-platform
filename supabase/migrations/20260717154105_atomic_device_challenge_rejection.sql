-- Supabase history version: 20260717154105.
-- Serialize approval and rejection for the same user so two button presses can
-- never approve a device and then revoke it while both requests report success.

begin;

create or replace function public.reject_account_device_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_approver_device_id uuid
)
returns table(result text, rejected_device_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  challenge_row public.account_device_verification_challenges%rowtype;
  revoke_result jsonb;
begin
  if p_user_id is null or p_challenge_id is null or p_approver_device_id is null then
    return query select 'invalid_input'::text, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

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
  where id = p_challenge_id
    and user_id = p_user_id
  for update;

  if not found then
    return query select 'challenge_not_found'::text, null::uuid;
    return;
  end if;

  if challenge_row.status <> 'pending' then
    return query select challenge_row.status, challenge_row.pending_device_id;
    return;
  end if;

  revoke_result := public.revoke_account_device_security(
    p_user_id,
    challenge_row.pending_device_id,
    'device_approval_rejected',
    false
  );

  if coalesce((revoke_result ->> 'ok')::boolean, false) is not true then
    return query select 'device_revoke_failed'::text, challenge_row.pending_device_id;
    return;
  end if;

  return query select 'rejected'::text, challenge_row.pending_device_id;
end;
$$;

revoke all on function public.reject_account_device_challenge(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reject_account_device_challenge(uuid, uuid, uuid)
  to service_role;

commit;
