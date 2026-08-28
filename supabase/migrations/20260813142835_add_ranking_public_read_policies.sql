-- Sanitized historical marker for the production migration ledger.
--
-- The remote statement created unconditional anonymous read policies. It is
-- superseded, unsafe, and deliberately not reproduced. Clean installs obtain
-- the audited fail-closed state from 20260813151446 instead.

do $historical_marker$
begin
  null;
end
$historical_marker$;
