-- DNA Intelligence owner bulk email center
-- Run this file in Supabase SQL editor before using the owner bulk email panel.

create table if not exists public.owner_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_type text not null check (campaign_type in ('system', 'education', 'marketing')),
  audience text not null check (audience in ('all', 'therapists', 'owners', 'plan', 'manual')),
  plan_code text check (plan_code is null or char_length(trim(plan_code)) <= 80),
  subject text not null check (char_length(trim(subject)) between 3 and 160),
  preview_text text check (preview_text is null or char_length(trim(preview_text)) <= 180),
  body text not null check (char_length(trim(body)) between 10 and 5000),
  action_label text check (action_label is null or char_length(trim(action_label)) <= 60),
  action_url text check (action_url is null or char_length(trim(action_url)) <= 300),
  status text not null default 'draft' check (status in ('draft', 'sending', 'completed', 'failed', 'cancelled')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create table if not exists public.owner_email_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.owner_email_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists owner_email_campaigns_created_idx
  on public.owner_email_campaigns (created_at desc);

create index if not exists owner_email_recipients_campaign_idx
  on public.owner_email_recipients (campaign_id, status);

alter table public.owner_email_campaigns enable row level security;
alter table public.owner_email_recipients enable row level security;

-- Owner email data is read and written by server-only service role APIs.
-- No direct authenticated-user RLS policies are created intentionally.
