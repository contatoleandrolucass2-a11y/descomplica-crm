# Remote-state rehearsal

This gate consumes a verified, root-only production backup without committing
or printing its contents. It restores exact production state in an isolated
source, exports only non-personal RBAC/catalog rows, restores a sanitized target,
and applies only the two PR #49 candidates.

```bash
node scripts/db/rehearsal/remote-state.mjs \
  --backup-dir /absolute/root-only/backup \
  --evidence docs/schema-history/remote-rehearsal-results.json
```

Required files are `roles.sql`, `schema.sql`, `data.sql`, history schema/data,
and `SHA256SUMS`. Every input must be owned by `root:root` without group/other
permissions. The Docker endpoint must be a local Unix socket.

The script fails if RBAC/catalog fingerprints change, Qlik table access reopens,
the target retains personal/commercial rows, Auth/MFA objects are incomplete,
or any migration other than `20260824230058` and `20260824230100` is applied.
Run the independent clean-install gate with `pnpm db:rehearse` and `pnpm db:test`.
