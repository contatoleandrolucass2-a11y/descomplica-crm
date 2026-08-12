-- Sanitized historical marker for a migration already present remotely.
--
-- The remote change retained anonymous execution and therefore is not an
-- authority to reproduce. Subsequent local migrations provide the fail-closed
-- target state. This no-op records only the audited version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
