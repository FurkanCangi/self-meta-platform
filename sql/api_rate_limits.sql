-- Shared API rate limit counters for production/serverless environments.
-- Service-role route handlers call public.check_api_rate_limit; clients do not
-- read or write this table.

create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_reset_idx
  on public.api_rate_limits (reset_at);

alter table public.api_rate_limits enable row level security;

revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

create or replace function public.check_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table(ok boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  window_interval interval := make_interval(secs => greatest(1, p_window_ms) / 1000.0);
  current_row public.api_rate_limits%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 or p_limit < 1 then
    ok := false;
    remaining := 0;
    reset_at := now_ts + window_interval;
    return next;
    return;
  end if;

  insert into public.api_rate_limits as limits (key, count, reset_at, updated_at)
  values (p_key, 1, now_ts + window_interval, now_ts)
  on conflict (key) do update
  set
    count = case
      when limits.reset_at <= now_ts then 1
      when limits.count >= p_limit then limits.count
      else limits.count + 1
    end,
    reset_at = case
      when limits.reset_at <= now_ts then now_ts + window_interval
      else limits.reset_at
    end,
    updated_at = now_ts
  returning * into current_row;

  ok := current_row.count <= p_limit;
  remaining := greatest(0, p_limit - current_row.count);
  reset_at := current_row.reset_at;
  return next;
end;
$$;

revoke all on function public.check_api_rate_limit(text, integer, integer) from public;
grant execute on function public.check_api_rate_limit(text, integer, integer) to service_role;
