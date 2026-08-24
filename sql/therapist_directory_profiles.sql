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
  country text not null default '',
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
  location_latitude double precision null
    check (location_latitude is null or location_latitude between -90 and 90),
  location_longitude double precision null
    check (location_longitude is null or location_longitude between -180 and 180),
  location_precision text null
    check (location_precision is null or location_precision in ('district', 'city')),
  location_provider text null,
  location_query_hash text null,
  location_verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_directory_location_pair_check check (
    (location_latitude is null and location_longitude is null and location_precision is null)
    or
    (location_latitude is not null and location_longitude is not null and location_precision is not null)
  )
);

drop index if exists public.therapist_directory_public_idx;
create index therapist_directory_public_idx
  on public.therapist_directory_profiles (publication_status, public_listing_enabled, country, city);

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

create table if not exists public.therapist_location_cache (
  query_hash text primary key check (length(query_hash) = 64),
  country text not null,
  city text not null,
  district text not null default '',
  status text not null check (status in ('verified', 'not_found', 'provider_error')),
  latitude double precision null check (latitude is null or latitude between -90 and 90),
  longitude double precision null check (longitude is null or longitude between -180 and 180),
  precision text null check (precision is null or precision in ('district', 'city')),
  provider text not null,
  provider_place_id text not null default '',
  display_name text not null default '',
  verified_at timestamptz null,
  retry_after timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint therapist_location_cache_pair_check check (
    (status = 'verified' and latitude is not null and longitude is not null and precision is not null and verified_at is not null)
    or
    (status <> 'verified' and latitude is null and longitude is null and precision is null)
  )
);

create index if not exists therapist_location_cache_retry_idx
  on public.therapist_location_cache (retry_after)
  where retry_after is not null;

alter table public.therapist_location_cache enable row level security;
revoke all privileges on table public.therapist_location_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.therapist_location_cache to service_role;
