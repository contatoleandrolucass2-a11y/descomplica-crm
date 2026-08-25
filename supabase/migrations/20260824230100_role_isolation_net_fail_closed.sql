-- Compatibility marker for the Auth/MFA/legal release.
--
-- An earlier local candidate attempted to patch optional Qlik relay and
-- commercial-engine isolation functions here. Those objects do not exist in
-- the production migration lineage and are outside this release. Keeping this
-- version as an explicit no-op preserves the published migration identifier
-- without creating roles, schemas, grants, functions or cross-domain
-- dependencies. Role-isolation hardening remains owned by its original,
-- separately gated migrations.

do $migration$
begin
  -- Deliberately no state change. This block makes execution explicit while
  -- remaining valid on both the production baseline and a clean installation.
  null;
end;
$migration$;
