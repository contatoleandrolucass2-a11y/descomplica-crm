import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./backup-local.sh", import.meta.url), "utf8");

test("backup is scoped to the new instance and refuses aliases and public files", () => {
  assert.ok(source.includes("root=/srv/descomplica-n8n"));
  assert.ok(source.includes("project=descomplica-n8n-crm"));
  assert.ok(source.includes('realpath -e "$root"'));
  assert.ok(source.includes("== 0:700"));
  assert.ok(source.includes("== 0:600"));
  assert.ok(source.includes("umask 077"));
  assert.ok(source.includes("flock -n 9"));
  assert.ok(!/docker (?:compose .*down|volume rm|system prune)/.test(source));
});

test("backup includes database, encryption configuration and filesystem", () => {
  assert.ok(source.includes("pg_dump -U n8n -d n8n -Fc"));
  assert.ok(source.includes(".env compose.yaml compose.https.yaml"));
  assert.ok(source.includes("n8n-data.tar.gz"));
  assert.ok(source.includes("sha256sum -c SHA256SUMS"));
});

test("restore proof uses an isolated disposable database, not the live database", () => {
  assert.ok(source.includes("docker run -d --network none"));
  assert.ok(source.includes("--tmpfs /var/lib/postgresql/data:rw,size=268435456"));
  assert.ok(source.includes('docker exec "$restore_id" pg_restore --exit-on-error'));
  assert.ok(source.includes('docker rm -f "$restore_id"'));
  assert.ok(source.includes("trap cleanup EXIT"));
  assert.ok(source.includes('docker unpause "$app"'));
  assert.ok(source.includes("application_boot=not_tested"));
  assert.ok(source.includes("credential_decryption=not_tested"));
  assert.ok(source.includes("offsite=false"));
});

test("readiness requires the final TCP server and the actual restore database", () => {
  assert.ok(
    source.includes(
      "docker exec \"$restore_id\" psql -h 127.0.0.1 -U n8n -d n8n_restore -Atc 'SELECT 1'",
    ),
  );
  assert.ok(!source.includes('docker exec "$restore_id" pg_isready'));
});
