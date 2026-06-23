-- Service-role-only RPC for reading owner audit events from the private owner_audit schema.
-- The owner UI checks OWNER_AUDIT_EMAILS before calling this; this function is not granted to anon/authenticated.

create or replace function public.owner_audit_read_events(
  p_source_table text default null,
  p_owner_id text default null,
  p_operation text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 250
)
returns table (
  id text,
  captured_at timestamptz,
  source_table text,
  operation text,
  actor_owner_id uuid,
  member_owner_id uuid,
  record_pk text,
  payload jsonb,
  changed_fields jsonb,
  deleted_visible boolean
)
language sql
security definer
set search_path = owner_audit, public, pg_temp
as $$
  select
    audit_events.id::text,
    audit_events.captured_at,
    audit_events.source_table,
    audit_events.operation,
    audit_events.actor_owner_id,
    audit_events.member_owner_id,
    audit_events.record_pk,
    audit_events.payload,
    audit_events.changed_fields,
    audit_events.deleted_visible
  from owner_audit.audit_events
  where (nullif(p_source_table, '') is null or audit_events.source_table = p_source_table)
    and (nullif(p_owner_id, '') is null or audit_events.member_owner_id::text = p_owner_id)
    and (nullif(p_operation, '') is null or audit_events.operation = p_operation)
    and (p_from is null or audit_events.captured_at >= p_from)
    and (p_to is null or audit_events.captured_at <= p_to)
  order by audit_events.captured_at desc
  limit least(greatest(coalesce(p_limit, 250), 1), 50000);
$$;

revoke all on function public.owner_audit_read_events(text, text, text, timestamptz, timestamptz, integer) from public;
revoke all on function public.owner_audit_read_events(text, text, text, timestamptz, timestamptz, integer) from anon;
revoke all on function public.owner_audit_read_events(text, text, text, timestamptz, timestamptz, integer) from authenticated;
grant execute on function public.owner_audit_read_events(text, text, text, timestamptz, timestamptz, integer) to service_role;
