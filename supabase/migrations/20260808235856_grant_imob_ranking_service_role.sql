-- Sanitized historical marker for a migration already present remotely.
--
-- The original granted forbidden direct table access to service_role and is
-- deliberately not reproduced. Later versioned migrations converge the local
-- schema and revoke that access. This no-op only keeps clean local rebuilds in
-- the same version order as the audited remote migration ledger.

do $historical_marker$
begin
  null;
end
$historical_marker$;
