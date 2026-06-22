-- Align legacy profile constraints with the current package and owner role model.
--
-- Symptom: test/payment-exempt users can hit generic login errors because the
-- app writes `professional`, while older live databases only allowed `pro`.

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan = any (array[
    'none',
    'student',
    'graduate',
    'pro',
    'professional',
    'corporate',
    'enterprise'
  ]::text[]));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array[
    'expert',
    'admin',
    'owner',
    'super_admin',
    'superadmin'
  ]::text[]));

notify pgrst, 'reload schema';
