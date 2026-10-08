-- Adds the Salesforce connection mask to the governed settings hierarchy.
-- The page uses the existing settings management permission and does not add
-- browser access to Salesforce credentials, ingestion runs or service secrets.

insert into public.app_pages
  (key, path, name, description, section, permission_key, parent_key, sort_order, is_navigation)
values
  (
    'crm.settings.connected_systems',
    '/app/configuracoes/conectar-sistemas',
    'Conectar Sistemas',
    'Conexão Salesforce e ingestão Supabase',
    'settings',
    'crm.settings.manage',
    'crm.settings',
    50,
    true
  )
on conflict (key) do update set
  path = excluded.path,
  name = excluded.name,
  description = excluded.description,
  section = excluded.section,
  permission_key = excluded.permission_key,
  parent_key = excluded.parent_key,
  sort_order = excluded.sort_order,
  is_navigation = excluded.is_navigation,
  is_active = true;
