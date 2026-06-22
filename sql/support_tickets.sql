-- DNA Intelligence support ticket center
-- Run this file in Supabase SQL editor before using the in-app support panel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default ('DST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid null references auth.users(id) on delete set null,
  requester_email text not null check (requester_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  requester_name text null check (requester_name is null or char_length(trim(requester_name)) <= 120),
  category text not null default 'technical'
    check (category in ('login', 'device', 'payment', 'report', 'education', 'technical', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  subject text not null check (char_length(trim(subject)) between 3 and 140),
  description text not null check (char_length(trim(description)) between 10 and 4000),
  page_url text null check (page_url is null or char_length(trim(page_url)) <= 500),
  browser_info text null check (browser_info is null or char_length(trim(browser_info)) <= 500),
  device_type text not null default 'unknown' check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  response_target_hours integer not null default 24 check (response_target_hours between 1 and 168),
  owner_note text null check (owner_note is null or char_length(trim(owner_note)) <= 3000),
  resolution_message text null check (resolution_message is null or char_length(trim(resolution_message)) <= 3000),
  assigned_owner_id uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  closed_at timestamptz null,
  last_user_message_at timestamptz not null default now(),
  last_owner_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid null references auth.users(id) on delete set null,
  sender_role text not null default 'user' check (sender_role in ('user', 'owner', 'system')),
  message text not null check (char_length(trim(message)) between 2 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  uploaded_by_user_id uuid null references auth.users(id) on delete set null,
  uploaded_by_role text not null default 'user' check (uploaded_by_role in ('user', 'owner')),
  storage_bucket text not null default 'support-attachments',
  storage_path text not null,
  original_file_name text not null check (char_length(trim(original_file_name)) <= 240),
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 8388608),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, priority, updated_at desc);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at asc);

create index if not exists support_ticket_attachments_ticket_idx
  on public.support_ticket_attachments (ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;

revoke all on public.support_tickets from anon;
revoke all on public.support_ticket_messages from anon;
revoke all on public.support_ticket_attachments from anon;

grant select, insert on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;
grant select on public.support_ticket_attachments to authenticated;

drop policy if exists "Users can read own support tickets" on public.support_tickets;
create policy "Users can read own support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own support tickets" on public.support_tickets;
create policy "Users can create own support tickets"
  on public.support_tickets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own support messages" on public.support_ticket_messages;
create policy "Users can read own support messages"
  on public.support_ticket_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_tickets st
      where st.id = ticket_id
        and st.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create own support messages" on public.support_ticket_messages;
create policy "Users can create own support messages"
  on public.support_ticket_messages
  for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and sender_role = 'user'
    and exists (
      select 1
      from public.support_tickets st
      where st.id = ticket_id
        and st.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own support attachments" on public.support_ticket_attachments;
create policy "Users can read own support attachments"
  on public.support_ticket_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_tickets st
      where st.id = ticket_id
        and st.user_id = auth.uid()
    )
  );

-- File bytes are uploaded and signed through server-only API routes with the service role.
-- Do not make the support-attachments bucket public.
