-- KVKK and operational security controls.
-- Adds request tracking, data-access audit, retention metadata, and helper
-- functions for anonymization workflows. Apply with service-role/admin access.

create table if not exists public.privacy_data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('access', 'delete', 'anonymize', 'export', 'rectify')),
  status text not null default 'received'
    check (status in ('received', 'verifying', 'in_progress', 'completed', 'rejected', 'cancelled')),
  request_message text null,
  resolution_note text null,
  ip_address text null,
  user_agent text null,
  received_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null
);

create index if not exists privacy_data_requests_user_idx
  on public.privacy_data_requests (user_id, received_at desc);

create index if not exists privacy_data_requests_status_idx
  on public.privacy_data_requests (status, received_at desc);

create table if not exists public.data_access_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users(id) on delete set null,
  subject_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text null,
  legal_basis text null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists data_access_audit_actor_idx
  on public.data_access_audit_events (actor_user_id, created_at desc);

create index if not exists data_access_audit_subject_idx
  on public.data_access_audit_events (subject_user_id, created_at desc);

create index if not exists data_access_audit_resource_idx
  on public.data_access_audit_events (resource_type, resource_id, created_at desc);

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  data_category text not null unique,
  table_name text null,
  retention_months integer null check (retention_months is null or retention_months > 0),
  disposal_action text not null check (disposal_action in ('delete', 'anonymize', 'review')),
  legal_basis text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_security_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  control_area text not null,
  required_state text not null,
  verification_owner text null,
  verification_cadence text not null default 'quarterly',
  last_verified_at timestamptz null,
  evidence_reference text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.data_retention_policies (
  data_category,
  table_name,
  retention_months,
  disposal_action,
  legal_basis,
  notes
)
values
  ('account_profile', 'profiles', 120, 'review', 'contract_and_legal_obligation', 'Hesap, fatura, sözleşme ve uyuşmazlık zamanaşımı dikkate alınarak periyodik gözden geçirme.'),
  ('client_records', 'clients', 120, 'anonymize', 'health_related_service_and_legal_obligation', 'Danışan/çocuk kayıtları operasyonel görünürlükten kaldırılmalı, gerekli hallerde anonimleştirilmelidir.'),
  ('assessments', 'assessments_v2', 120, 'anonymize', 'health_related_service_and_legal_obligation', 'Ölçek yanıtları ve klinik değerlendirme verileri özel nitelikli veri kabul edilir.'),
  ('reports', 'reports', 120, 'anonymize', 'health_related_service_and_legal_obligation', 'Rapor metinleri özel nitelikli veri içerebilir.'),
  ('legal_acceptances', 'legal_acceptances', 120, 'review', 'legal_claim_and_compliance_evidence', 'Clickwrap ve açık rıza kanıtları yasal ispat için sınırlı şekilde saklanır.'),
  ('security_audit', 'account_security_events', 24, 'delete', 'security_and_abuse_prevention', 'Güvenlik olay kayıtları anomali analizi ve kötüye kullanım incelemesi için tutulur.'),
  ('video_access_logs', 'education_video_access_logs', 24, 'delete', 'abuse_prevention_and_leak_attribution', 'Video erişim/watermark logları sızıntı incelemesi için sınırlı süre tutulur.')
on conflict (data_category) do update
set
  table_name = excluded.table_name,
  retention_months = excluded.retention_months,
  disposal_action = excluded.disposal_action,
  legal_basis = excluded.legal_basis,
  notes = excluded.notes,
  updated_at = now();

insert into public.operational_security_controls (
  control_key,
  control_area,
  required_state,
  verification_owner,
  verification_cadence,
  notes
)
values
  ('backup_encryption', 'backup_security', 'Database and object-storage backups must be encrypted at rest and protected by least-privilege admin access.', 'platform_admin', 'quarterly', 'Verify Supabase/Vercel/provider backup encryption and access controls.'),
  ('backup_restore_test', 'backup_security', 'A restore drill must be performed and documented before production launch and at least quarterly.', 'platform_admin', 'quarterly', 'Keep evidence outside the public repository.'),
  ('backup_retention_limit', 'backup_security', 'Backup retention must not exceed documented legal/operational need.', 'platform_admin', 'quarterly', 'Align with retention policy and contractual/legal requirements.'),
  ('production_debug_logs_off', 'logging', 'DNA_REPORT_DEBUG must remain false in production.', 'platform_admin', 'monthly', 'Temporary debug sessions require approval and post-session cleanup.')
on conflict (control_key) do update
set
  control_area = excluded.control_area,
  required_state = excluded.required_state,
  verification_owner = excluded.verification_owner,
  verification_cadence = excluded.verification_cadence,
  notes = excluded.notes,
  updated_at = now();

alter table public.privacy_data_requests enable row level security;
alter table public.data_access_audit_events enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.operational_security_controls enable row level security;

revoke all on public.privacy_data_requests from anon;
revoke all on public.data_access_audit_events from anon;
revoke all on public.data_retention_policies from anon;
revoke all on public.operational_security_controls from anon;

revoke insert, update, delete on public.privacy_data_requests from authenticated;
revoke insert, update, delete on public.data_access_audit_events from authenticated;
revoke insert, update, delete on public.data_retention_policies from authenticated;
revoke insert, update, delete on public.operational_security_controls from authenticated;

grant select on public.privacy_data_requests to authenticated;
grant select on public.data_access_audit_events to authenticated;
grant select on public.data_retention_policies to authenticated;
grant select on public.operational_security_controls to authenticated;

drop policy if exists "Users can read own privacy data requests" on public.privacy_data_requests;
create policy "Users can read own privacy data requests"
on public.privacy_data_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own data access audit events" on public.data_access_audit_events;
create policy "Users can read own data access audit events"
on public.data_access_audit_events
for select
to authenticated
using (auth.uid() = subject_user_id or auth.uid() = actor_user_id);

drop policy if exists "Authenticated users can read retention policy metadata" on public.data_retention_policies;
create policy "Authenticated users can read retention policy metadata"
on public.data_retention_policies
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read operational security controls" on public.operational_security_controls;
create policy "Authenticated users can read operational security controls"
on public.operational_security_controls
for select
to authenticated
using (true);

create or replace function public.mask_email_for_privacy(value text)
returns text
language sql
immutable
as $$
  select case
    when value is null or position('@' in value) = 0 then null
    else left(split_part(value, '@', 1), 2) || '***@' || split_part(value, '@', 2)
  end;
$$;

create or replace function public.mark_user_privacy_erasure_requested(target_user_id uuid, request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    full_name = null,
    plan = coalesce(plan, 'none')
  where user_id = target_user_id;

  update public.clients
  set
    deleted_at = coalesce(deleted_at, now())
  where owner_id = target_user_id
    and deleted_at is null;

  insert into public.data_access_audit_events (
    actor_user_id,
    subject_user_id,
    action,
    resource_type,
    resource_id,
    legal_basis,
    metadata
  )
  values (
    target_user_id,
    target_user_id,
    'privacy_erasure_marked',
    'privacy_data_request',
    request_id::text,
    'kvkk_data_subject_request',
    jsonb_build_object('mode', 'soft_delete_visibility_removed')
  );
end;
$$;
