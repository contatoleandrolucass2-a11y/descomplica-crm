-- Sanitized historical marker for the production migration ledger.
--
-- Production recorded this exact change under version 20260813133534. Its
-- statement SHA-256 matches the canonical, safe migration already replayed on
-- clean installs as 20260813115335. Replaying the DDL here would duplicate the
-- same operation. This marker reconciles only the version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
