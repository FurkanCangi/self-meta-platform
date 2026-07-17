-- Supabase history version: 20260717130825.
begin;

alter table public.account_sessions
  add column if not exists cookie_signing_upgraded_at timestamptz null,
  add column if not exists auth_session_id uuid null;

comment on column public.account_sessions.cookie_signing_upgraded_at is
  'One-time marker used while upgrading pre-2026-07-17 raw app-session cookies to HMAC-sealed cookies.';

comment on column public.account_sessions.auth_session_id is
  'Supabase Auth session_id claim bound to this trusted app session.';

create index if not exists account_sessions_auth_session_idx
  on public.account_sessions (user_id, auth_session_id, status)
  where auth_session_id is not null;

-- A Supabase bearer session must not authorize active app sessions on two
-- different device rows. Normal logins create a distinct auth session per
-- browser; duplicate active bindings are rejected by this database invariant.
create unique index if not exists account_sessions_one_active_auth_session_idx
  on public.account_sessions (user_id, auth_session_id)
  where status = 'active' and auth_session_id is not null;

-- Preserve only legacy browser sessions that can be paired unambiguously with
-- the Supabase auth session created in the same login ceremony. The formerly
-- browser-readable raw app-session UUID is never accepted as proof by itself.
with auth_candidates as (
  select
    app_session.id as app_session_id,
    auth_session.id as auth_session_id,
    count(*) over (partition by app_session.id) as candidate_count,
    count(*) over (partition by auth_session.id) as target_count
  from public.account_sessions as app_session
  join auth.sessions as auth_session
    on auth_session.user_id = app_session.user_id
   and abs(extract(epoch from (auth_session.created_at - app_session.created_at))) <= 30
   and (auth_session.not_after is null or auth_session.not_after > now())
  where app_session.status = 'active'
    and app_session.expires_at > now()
    and app_session.auth_session_id is null
), unique_candidates as (
  select app_session_id, auth_session_id
  from auth_candidates
  where candidate_count = 1 and target_count = 1
)
update public.account_sessions as app_session
set auth_session_id = unique_candidates.auth_session_id
from unique_candidates
where app_session.id = unique_candidates.app_session_id
  and app_session.auth_session_id is null;

commit;
