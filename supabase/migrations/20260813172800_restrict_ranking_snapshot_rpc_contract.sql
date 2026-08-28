-- Sanitized historical marker for the production migration ledger.
--
-- The remote statement revises the confidential legacy ranking read contract.
-- It depends on verifier material that must not enter Git and is not required
-- by this application. This marker reconciles only the version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
