-- Salesforce batches can exceed the Data API's inherited eight-second budget.
-- Keep the exception finite and scoped to the existing machine-only RPC.
-- ALTER preserves its implementation, owner, search_path, grants and data.
alter function public.ingest_crm_salesforce_snapshot(jsonb)
  set statement_timeout = '30s';

notify pgrst, 'reload schema';

-- Rollback (only after checking compatibility and the ingestion schedule):
-- alter function public.ingest_crm_salesforce_snapshot(jsonb) reset statement_timeout;
-- notify pgrst, 'reload schema';
