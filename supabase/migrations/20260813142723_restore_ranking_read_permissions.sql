-- Sanitized historical marker for the production migration ledger.
--
-- The remote statement restored anonymous and broad authenticated reads on
-- Qlik ranking tables. That change is superseded, unsafe, and deliberately not
-- reproduced. The later 20260813151446 migration owns the fail-closed state.

do $historical_marker$
begin
  null;
end
$historical_marker$;
