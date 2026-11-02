-- Execute only in a disposable operational LEAD+ database after the WhatsApp migration.
CREATE EXTENSION IF NOT EXISTS pgtap;
BEGIN;
SELECT plan(50);
SELECT ok(c.relrowsecurity, 'RLS enabled: ' || c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='c2s_app' AND c.relkind='r' AND c.relname IN (
 'wa_accounts','wa_contacts','wa_conversations','wa_messages','wa_assignment_history',
 'wa_internal_notes','wa_webhook_events','wa_changes','wa_availability','wa_reads'
) ORDER BY c.relname;
SELECT ok(NOT has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE'),
 'No direct browser or service-role table grant: ' || r.role_name || '/' || c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
WHERE n.nspname='c2s_app' AND c.relkind='r' AND c.relname IN (
 'wa_accounts','wa_contacts','wa_conversations','wa_messages','wa_assignment_history',
 'wa_internal_notes','wa_webhook_events','wa_changes','wa_availability','wa_reads'
) ORDER BY c.relname,r.role_name;
SELECT ok(has_table_privilege('c2s_backend_scope',c.oid,'SELECT') AND
 has_table_privilege('c2s_backend_scope',c.oid,'INSERT') AND
 has_table_privilege('c2s_backend_scope',c.oid,'UPDATE') AND
 has_table_privilege('c2s_backend_scope',c.oid,'DELETE'),
 'Explicit private operational access: ' || c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='c2s_app' AND c.relkind='r' AND c.relname IN (
 'wa_accounts','wa_contacts','wa_conversations','wa_messages','wa_assignment_history',
 'wa_internal_notes','wa_webhook_events','wa_changes','wa_availability','wa_reads'
) ORDER BY c.relname;
SELECT * FROM finish();
ROLLBACK;
