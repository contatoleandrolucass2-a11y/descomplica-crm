-- Sanitized historical marker for the production migration ledger.
--
-- Production applied the same RBAC statements already replayed on clean
-- installs as 20260813140000; the remote copy only omits an explanatory comment
-- and its final newline. This marker reconciles only the version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
