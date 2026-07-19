-- DNA Asistani V1 ownership lookups and audit retention metadata.
-- Idempotent: safe to re-run after the core tables and KVKK controls exist.

create index if not exists clients_dna_chat_owner_active_idx
  on public.clients (owner_id, created_at desc, id)
  where deleted_at is null;

create index if not exists assessments_dna_chat_client_active_idx
  on public.assessments_v2 (client_id, created_at desc, id)
  where deleted_at is null;

create index if not exists reports_dna_chat_assessment_recent_idx
  on public.reports (assessment_id, created_at desc, id);

insert into public.data_retention_policies (
  data_category,
  table_name,
  retention_months,
  disposal_action,
  legal_basis,
  notes
)
values (
  'dna_chat_access_audit',
  'data_access_audit_events',
  24,
  'delete',
  'security_and_health_data_access_accountability',
  'DNA Asistani auditlari yalniz istek kimligi, mod, intent, siniflandirma, motor ve sozlesme surumu, ret durumu ve kaynak kimliklerini tutar; soru, cevap, danisan kodu, rapor kimligi, skor veya vaka bulgusu tutulmaz. Otomatik sure sonu imha mekanizmasi ayrica dogrulanmalidir.'
)
on conflict (data_category) do update
set
  table_name = excluded.table_name,
  retention_months = excluded.retention_months,
  disposal_action = excluded.disposal_action,
  legal_basis = excluded.legal_basis,
  notes = excluded.notes,
  updated_at = now();
