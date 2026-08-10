-- Sanitized historical marker for a migration already present remotely.
--
-- The original embedded a sensitive verifier and exposed a SECURITY DEFINER
-- publisher. Neither implementation nor authority is copied here. The safe
-- relay/cutover migrations supersede that contract; this statement is a no-op
-- used only to align versioned migration history during isolated rehearsals.

do $historical_marker$
begin
  null;
end
$historical_marker$;
