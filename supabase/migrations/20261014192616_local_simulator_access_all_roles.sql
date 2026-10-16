-- The local Users screen manages simulator viewing and execution as one access.
-- Existing account, scope, runtime, and individual override checks remain in
-- force. This migration only expands the defaults of the seven current roles.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values
  ('crm.simulators.view', 'Visualizar simuladores autorizados para o usuário', 10),
  ('crm.simulators.execute', 'Executar simuladores autorizados para o usuário', 10)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from unnest(array[
  'master', 'admin', 'coordinator', 'manager_house', 'manager_imob',
  'broker_house', 'broker_imob'
]) as approved_roles(role_key)
cross join unnest(array[
  'crm.simulators.view', 'crm.simulators.execute'
]) as simulator_permissions(permission_key)
on conflict (role_key, permission_key) do nothing;

-- Do not remove explicit allows or denies. Effective access still depends on
-- approval, active status, valid reporting scope, MFA, and individual overrides.
notify pgrst, 'reload schema';

commit;
