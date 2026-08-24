alter table public.therapist_directory_profiles
  add column if not exists country text not null default '',
  add column if not exists location_latitude double precision null,
  add column if not exists location_longitude double precision null,
  add column if not exists location_precision text null,
  add column if not exists location_provider text null,
  add column if not exists location_query_hash text null,
  add column if not exists location_verified_at timestamptz null;

alter table public.therapist_directory_profiles
  drop constraint if exists therapist_directory_location_latitude_check,
  add constraint therapist_directory_location_latitude_check
    check (location_latitude is null or location_latitude between -90 and 90),
  drop constraint if exists therapist_directory_location_longitude_check,
  add constraint therapist_directory_location_longitude_check
    check (location_longitude is null or location_longitude between -180 and 180),
  drop constraint if exists therapist_directory_location_precision_check,
  add constraint therapist_directory_location_precision_check
    check (location_precision is null or location_precision in ('district', 'city')),
  drop constraint if exists therapist_directory_location_pair_check,
  add constraint therapist_directory_location_pair_check check (
    (location_latitude is null and location_longitude is null and location_precision is null)
    or
    (location_latitude is not null and location_longitude is not null and location_precision is not null)
  );

create index if not exists therapist_directory_location_query_idx
  on public.therapist_directory_profiles (location_query_hash)
  where location_query_hash is not null;

create index if not exists therapist_directory_public_location_idx
  on public.therapist_directory_profiles (publication_status, public_listing_enabled, country, city);

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
