-- Supabase history version: 20260717144927.
-- This version was applied directly to the live project and briefly restored
-- authenticated browser SELECT policies on account-security tables. Replaying
-- that regression on a fresh database is intentionally a no-op. The following
-- 20260717153616 and 20260717153624 migrations record and enforce the final
-- server-API-only access boundary.

select 1;
