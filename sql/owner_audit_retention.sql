create schema if not exists owner_audit;

create table if not exists owner_audit.audit_events (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  source_table text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_owner_id uuid null,
  member_owner_id uuid null,
  record_pk text not null,
  payload jsonb not null,
  changed_fields jsonb null,
  deleted_visible boolean not null default false
);

create index if not exists audit_events_source_table_idx
  on owner_audit.audit_events (source_table, captured_at desc);

create index if not exists audit_events_member_owner_idx
  on owner_audit.audit_events (member_owner_id, captured_at desc);

create index if not exists audit_events_record_pk_idx
  on owner_audit.audit_events (source_table, record_pk, captured_at desc);

alter table owner_audit.audit_events enable row level security;

revoke all on schema owner_audit from anon, authenticated;
revoke all on all tables in schema owner_audit from anon, authenticated;

create or replace function owner_audit.jsonb_changed_fields(old_row jsonb, new_row jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, jsonb_build_object('old', old_value, 'new', new_value))
      from (
        select
          coalesce(o.key, n.key) as key,
          o.value as old_value,
          n.value as new_value
        from jsonb_each(coalesce(old_row, '{}'::jsonb)) o
        full join jsonb_each(coalesce(new_row, '{}'::jsonb)) n using (key)
        where o.value is distinct from n.value
      ) diff
    ),
    '{}'::jsonb
  );
$$;

create or replace function owner_audit.capture_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, owner_audit
as $$
declare
  current_row jsonb;
  previous_row jsonb;
  raw_owner_id text;
  raw_actor_id text;
begin
  current_row := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  previous_row := case when tg_op = 'INSERT' then null else to_jsonb(old) end;

  raw_owner_id := coalesce(
    current_row ->> 'owner_id',
    previous_row ->> 'owner_id'
  );

  raw_actor_id := current_setting('request.jwt.claim.sub', true);

  insert into owner_audit.audit_events (
    source_table,
    operation,
    actor_owner_id,
    member_owner_id,
    record_pk,
    payload,
    changed_fields,
    deleted_visible
  )
  values (
    tg_table_name,
    tg_op,
    nullif(raw_actor_id, '')::uuid,
    nullif(raw_owner_id, '')::uuid,
    coalesce(current_row ->> 'id', previous_row ->> 'id', 'unknown'),
    coalesce(current_row, previous_row, '{}'::jsonb),
    case
      when tg_op = 'UPDATE' then owner_audit.jsonb_changed_fields(previous_row, current_row)
      else null
    end,
    case
      when tg_op = 'DELETE' then true
      when tg_op = 'UPDATE' and coalesce(current_row ->> 'deleted_at', '') <> '' then true
      else false
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists owner_audit_clients_trigger on public.clients;
create trigger owner_audit_clients_trigger
after insert or update or delete on public.clients
for each row execute function owner_audit.capture_row_change();

drop trigger if exists owner_audit_assessments_v2_trigger on public.assessments_v2;
create trigger owner_audit_assessments_v2_trigger
after insert or update or delete on public.assessments_v2
for each row execute function owner_audit.capture_row_change();

drop trigger if exists owner_audit_reports_trigger on public.reports;
create trigger owner_audit_reports_trigger
after insert or update or delete on public.reports
for each row execute function owner_audit.capture_row_change();

comment on schema owner_audit is 'Owner-only append-only audit schema. Member UI tarafında görünmez; owner export ve denetim amaçlıdır.';
comment on table owner_audit.audit_events is 'Insert/update/delete sonrası append-only snapshot. Silinse bile veri owner audit katmanında kalır.';
