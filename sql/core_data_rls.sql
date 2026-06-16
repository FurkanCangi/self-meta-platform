-- Core tenant isolation policies for browser-accessed Supabase tables.
-- Run after profiles, clients, assessments_v2, and reports exist.

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.assessments_v2 enable row level security;
alter table public.reports enable row level security;

revoke all on public.profiles from anon;
revoke all on public.clients from anon;
revoke all on public.assessments_v2 from anon;
revoke all on public.reports from anon;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own default profile" on public.profiles;
create policy "Users can create own default profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and coalesce(role, 'expert') = 'expert'
  and coalesce(plan, 'none') = 'none'
);

drop policy if exists "Users can read own clients" on public.clients;
create policy "Users can read own clients"
on public.clients
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can create own clients" on public.clients;
create policy "Users can create own clients"
on public.clients
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own clients" on public.clients;
create policy "Users can update own clients"
on public.clients
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own clients" on public.clients;
create policy "Users can delete own clients"
on public.clients
for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can read own assessments" on public.assessments_v2;
create policy "Users can read own assessments"
on public.assessments_v2
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = assessments_v2.client_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can create own assessments" on public.assessments_v2;
create policy "Users can create own assessments"
on public.assessments_v2
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.id = assessments_v2.client_id
      and c.owner_id = auth.uid()
      and c.deleted_at is null
  )
);

drop policy if exists "Users can update own assessments" on public.assessments_v2;
create policy "Users can update own assessments"
on public.assessments_v2
for update
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = assessments_v2.client_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = assessments_v2.client_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete own assessments" on public.assessments_v2;
create policy "Users can delete own assessments"
on public.assessments_v2
for delete
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = assessments_v2.client_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports"
on public.reports
for select
to authenticated
using (
  exists (
    select 1
    from public.assessments_v2 a
    join public.clients c on c.id = a.client_id
    where a.id = reports.assessment_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can create own reports" on public.reports;
create policy "Users can create own reports"
on public.reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessments_v2 a
    join public.clients c on c.id = a.client_id
    where a.id = reports.assessment_id
      and c.owner_id = auth.uid()
      and a.deleted_at is null
      and c.deleted_at is null
  )
);

drop policy if exists "Users can update own reports" on public.reports;
create policy "Users can update own reports"
on public.reports
for update
to authenticated
using (
  exists (
    select 1
    from public.assessments_v2 a
    join public.clients c on c.id = a.client_id
    where a.id = reports.assessment_id
      and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assessments_v2 a
    join public.clients c on c.id = a.client_id
    where a.id = reports.assessment_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete own reports" on public.reports;
create policy "Users can delete own reports"
on public.reports
for delete
to authenticated
using (
  exists (
    select 1
    from public.assessments_v2 a
    join public.clients c on c.id = a.client_id
    where a.id = reports.assessment_id
      and c.owner_id = auth.uid()
  )
);
