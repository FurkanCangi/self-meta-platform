-- Repair legacy notification links that pointed to the old/nonexistent trainings route.
-- Safe to run repeatedly.
update public.notifications
set action_url = '/education'
where action_url in ('/training', '/trainings', '/egitim', '/egitimler');
