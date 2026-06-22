-- DNA Intelligence notification center
-- Run this file in Supabase SQL editor before using the owner notification panel.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  message text not null check (char_length(trim(message)) between 5 and 800),
  kind text not null default 'info' check (kind in ('info', 'education', 'system', 'warning')),
  audience text not null default 'therapists' check (audience in ('all', 'therapists', 'owners')),
  target_user_ids uuid[] not null default '{}'::uuid[],
  action_label text check (action_label is null or char_length(trim(action_label)) <= 48),
  action_url text check (action_url is null or char_length(trim(action_url)) <= 240),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notifications_published_idx
  on public.notifications (status, audience, published_at desc);

create index if not exists notification_reads_user_idx
  on public.notification_reads (user_id, read_at desc);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists "Authenticated users can read published notifications" on public.notifications;
create policy "Authenticated users can read published notifications"
  on public.notifications
  for select
  to authenticated
  using (
    status = 'published'
    and published_at <= now()
    and (
      audience in ('all', 'therapists')
      or auth.uid() = any(target_user_ids)
    )
  );

drop policy if exists "Users can read their notification receipts" on public.notification_reads;
create policy "Users can read their notification receipts"
  on public.notification_reads
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can mark their notifications as read" on public.notification_reads;
create policy "Users can mark their notifications as read"
  on public.notification_reads
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their notification receipts" on public.notification_reads;
create policy "Users can update their notification receipts"
  on public.notification_reads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.notifications to authenticated;
grant select, insert, update on public.notification_reads to authenticated;

