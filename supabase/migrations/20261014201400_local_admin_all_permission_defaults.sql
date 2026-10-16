-- Administrator inherits every permission currently registered in the catalog.
-- Existing individual overrides, role levels, delegation limits, reporting
-- scopes, account status checks, and commercial runtime gates remain unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.role_permissions (role_key, permission_key)
select 'admin', permission.key
from public.permissions permission
on conflict (role_key, permission_key) do nothing;

notify pgrst, 'reload schema';

commit;
