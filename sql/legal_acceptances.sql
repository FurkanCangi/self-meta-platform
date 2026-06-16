create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  plan_code text not null default 'none',
  accepted_documents jsonb not null,
  accepted_at timestamptz not null default now(),
  ip_address text null,
  user_agent text null,
  source_path text null
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, accepted_at desc);

create index if not exists legal_acceptances_email_idx
  on public.legal_acceptances (lower(email), accepted_at desc);

alter table public.legal_acceptances enable row level security;

revoke insert, update, delete on public.legal_acceptances from anon, authenticated;

drop policy if exists "Users can read own legal acceptances" on public.legal_acceptances;
create policy "Users can read own legal acceptances"
on public.legal_acceptances
for select
to authenticated
using (auth.uid() = user_id);

comment on table public.legal_acceptances is 'Clickwrap kabul kanitlari: dokuman versiyonlari, paket, zaman, IP, user-agent ve kaynak sayfa.';
comment on column public.legal_acceptances.accepted_documents is 'Kabul edilen aktif hukuki dokumanlarin id/title/version/href snapshot listesi.';
