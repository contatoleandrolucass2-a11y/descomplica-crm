-- All Master accounts inherit every permission in the deployed catalog.
-- This does not change account eligibility, MFA, reporting scopes or runtime gates.
-- Existing individual overrides and defaults of other roles remain unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.role_permissions (role_key, permission_key)
select 'master', permission.key
from public.permissions permission
on conflict (role_key, permission_key) do nothing;

notify pgrst, 'reload schema';

commit;
