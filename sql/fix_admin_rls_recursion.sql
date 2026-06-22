-- Fix recursive RLS caused by public.is_admin() reading public.profiles while
-- public.profiles policies also called public.is_admin().
--
-- Symptom in the app: "stack depth limit exceeded" while inserting
-- assessments_v2 rows from the browser.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'owner', 'super_admin')
  );
$$;

alter function public.is_admin() owner to postgres;
revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_admin() from authenticated;
grant execute on function public.is_admin() to service_role;

drop policy if exists "assessments_v2_insert_own" on public.assessments_v2;
drop policy if exists "assessments_v2_select_own" on public.assessments_v2;
drop policy if exists "assessments_v2_update_own" on public.assessments_v2;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "reports_insert_own" on public.reports;
drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

notify pgrst, 'reload schema';
