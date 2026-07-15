-- Public therapist directory profile storage.
-- Public listing data is served only through server API routes; anon users must
-- not read this table directly.

create table if not exists public.therapist_directory_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  profession text not null default '',
  title text not null default '',
  workplace text not null default '',
  city text not null default '',
  district text not null default '',
  public_phone text not null default '',
  public_email text not null default '',
  short_address text not null default '',
  specialties text not null default '',
  education_completed_at timestamptz null,
  public_listing_enabled boolean not null default false,
  publication_status text not null default 'pending'
    check (publication_status in ('pending', 'approved', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.therapist_directory_public_idx;
create index therapist_directory_public_idx
  on public.therapist_directory_profiles (publication_status, public_listing_enabled, city);

alter table public.therapist_directory_profiles enable row level security;

revoke all on public.therapist_directory_profiles from anon;
revoke all on public.therapist_directory_profiles from authenticated;
grant select, insert, update, delete on public.therapist_directory_profiles to service_role;

drop policy if exists "No direct anon therapist directory access" on public.therapist_directory_profiles;
create policy "No direct anon therapist directory access"
on public.therapist_directory_profiles
for select
to anon
using (false);

drop trigger if exists therapist_directory_profiles_set_updated_at on public.therapist_directory_profiles;
create or replace function public.set_therapist_directory_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger therapist_directory_profiles_set_updated_at
before update on public.therapist_directory_profiles
for each row
execute function public.set_therapist_directory_profiles_updated_at();
