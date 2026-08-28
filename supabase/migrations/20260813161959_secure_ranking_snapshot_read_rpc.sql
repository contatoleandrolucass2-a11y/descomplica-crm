-- Sanitized historical marker for the production migration ledger.
--
-- The remote statement contains confidential verifier material for a legacy
-- ranking reader. Neither verifier nor RPC implementation is copied into Git.
-- Current production objects remain untouched until a separately authorized
-- reader cutover. This marker reconciles only the version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
