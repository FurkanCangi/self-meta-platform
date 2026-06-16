-- Education video access protection and leak-attribution infrastructure.
-- This does not make videos impossible to record; it makes access private,
-- short-lived, logged, and attributable through user-specific watermark codes.

create table if not exists public.education_video_assets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text null,
  provider text not null default 'supabase',
  provider_asset_id text null,
  provider_library_id text null,
  playback_policy text not null default 'signed_url',
  provider_status text not null default 'draft',
  storage_bucket text not null default 'education-videos',
  storage_path text null,
  hls_manifest_path text null,
  required_plan text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_video_asset_provider_check
    check (provider in ('supabase', 'bunny')),
  constraint education_video_asset_playback_policy_check
    check (playback_policy in ('signed_url', 'signed_embed', 'signed_hls')),
  constraint education_video_asset_status_check
    check (provider_status in ('draft', 'processing', 'ready', 'failed')),
  constraint education_video_asset_has_path
    check (
      (provider = 'supabase' and (storage_path is not null or hls_manifest_path is not null))
      or
      (provider = 'bunny' and provider_asset_id is not null and provider_library_id is not null)
    )
);

create index if not exists education_video_assets_active_idx
  on public.education_video_assets (is_active, slug);

create table if not exists public.education_video_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.education_video_assets(id) on delete cascade,
  token_hash text not null unique,
  watermark_code text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  expires_at timestamptz not null,
  revoked_at timestamptz null
);

create index if not exists education_video_access_tokens_user_idx
  on public.education_video_access_tokens (user_id, video_id, created_at desc);

create index if not exists education_video_access_tokens_expiry_idx
  on public.education_video_access_tokens (expires_at, revoked_at);

create table if not exists public.education_video_playback_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.education_video_assets(id) on delete cascade,
  token_id uuid null references public.education_video_access_tokens(id) on delete set null,
  player_session_id text not null,
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz null,
  ip_address text null,
  user_agent text null,
  watermark_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_video_playback_session_unique
    unique (user_id, video_id, player_session_id)
);

create index if not exists education_video_playback_sessions_active_idx
  on public.education_video_playback_sessions (user_id, video_id, last_heartbeat_at desc)
  where ended_at is null;

create index if not exists education_video_playback_sessions_watermark_idx
  on public.education_video_playback_sessions (watermark_code)
  where watermark_code is not null;

create table if not exists public.education_video_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.education_video_assets(id) on delete cascade,
  token_id uuid null references public.education_video_access_tokens(id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default now(),
  ip_address text null,
  user_agent text null,
  watermark_code text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists education_video_access_logs_user_idx
  on public.education_video_access_logs (user_id, created_at desc);

create index if not exists education_video_access_logs_video_idx
  on public.education_video_access_logs (video_id, created_at desc);

create index if not exists education_video_access_logs_watermark_idx
  on public.education_video_access_logs (watermark_code)
  where watermark_code is not null;

alter table public.education_video_assets enable row level security;
alter table public.education_video_access_tokens enable row level security;
alter table public.education_video_playback_sessions enable row level security;
alter table public.education_video_access_logs enable row level security;

revoke all on public.education_video_assets from anon;
revoke all on public.education_video_access_tokens from anon;
revoke all on public.education_video_playback_sessions from anon;
revoke all on public.education_video_access_logs from anon;
revoke insert, update, delete on public.education_video_assets from authenticated;
revoke insert, update, delete on public.education_video_access_tokens from authenticated;
revoke insert, update, delete on public.education_video_playback_sessions from authenticated;
revoke insert, update, delete on public.education_video_access_logs from authenticated;
grant select on public.education_video_playback_sessions to authenticated;
grant select on public.education_video_access_logs to authenticated;

drop policy if exists "Users can read own education video playback sessions" on public.education_video_playback_sessions;
create policy "Users can read own education video playback sessions"
on public.education_video_playback_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own education video logs" on public.education_video_access_logs;
create policy "Users can read own education video logs"
on public.education_video_access_logs
for select
to authenticated
using (auth.uid() = user_id);
