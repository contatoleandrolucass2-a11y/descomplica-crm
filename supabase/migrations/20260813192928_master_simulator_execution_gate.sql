-- Sanitized historical marker for the production migration ledger.
--
-- Production recorded the canonical 20260813143000 Master execution gate
-- without its final newline. Clean installs already replay those exact SQL
-- statements. This marker reconciles only the version boundary.

do $historical_marker$
begin
  null;
end
$historical_marker$;
