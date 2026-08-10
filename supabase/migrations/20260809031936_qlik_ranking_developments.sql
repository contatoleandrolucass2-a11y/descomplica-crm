-- Sanitized historical marker for a migration already present remotely.
--
-- Remote table shape is converged independently by the later fail-closed Qlik
-- migration. Commercial formulae, verifier material and permissive grants are
-- intentionally omitted. This no-op preserves the historical version only.

do $historical_marker$
begin
  null;
end
$historical_marker$;
