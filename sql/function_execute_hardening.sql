-- Restrict helper function execution to the roles that actually need them.
-- This keeps trigger/RPC helpers callable by backend/service operations without
-- leaving SECURITY DEFINER functions executable by anon/authenticated users.

revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.mark_user_privacy_erasure_requested(uuid, uuid) from public;
revoke execute on function public.mark_user_privacy_erasure_requested(uuid, uuid) from anon;
revoke execute on function public.mark_user_privacy_erasure_requested(uuid, uuid) from authenticated;
grant execute on function public.mark_user_privacy_erasure_requested(uuid, uuid) to service_role;

revoke all on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
grant execute on function public.rls_auto_enable() to service_role;

revoke all on function public.mask_email_for_privacy(text) from public;
revoke execute on function public.mask_email_for_privacy(text) from anon;
revoke execute on function public.mask_email_for_privacy(text) from authenticated;
grant execute on function public.mask_email_for_privacy(text) to service_role;

revoke all on function owner_audit.jsonb_changed_fields(jsonb, jsonb) from public;
grant execute on function owner_audit.jsonb_changed_fields(jsonb, jsonb) to service_role;
