#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Fixed scope: never discovers or touches another n8n installation.
root=/srv/descomplica-n8n
project=descomplica-n8n-crm
app=descomplica-n8n-crm-n8n-1
db=descomplica-n8n-crm-postgres-1
volume=descomplica-n8n-crm-n8n-data
[[ $(id -u) == 0 && -d $root && ! -L $root ]]
[[ $(realpath -e "$root") == "$root" ]]
[[ $(stat -c '%u:%a' "$root") == 0:700 ]]
for file in .env compose.yaml compose.https.yaml; do
  [[ -f $root/$file && ! -L $root/$file ]]
done
[[ $(stat -c '%u:%a' "$root/.env") == 0:600 ]]
for container in "$app" "$db"; do
  [[ $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container") == "$project" ]]
  [[ $(docker inspect -f '{{.State.Running}}' "$container") == true ]]
done
[[ $(docker inspect -f '{{.State.Paused}}' "$app") == false ]]
mount=$(docker volume inspect -f '{{.Mountpoint}}' "$volume")
[[ $mount == /var/lib/docker/volumes/descomplica-n8n-crm-n8n-data/_data ]]
[[ $(realpath -e "$mount") == "$mount" ]]
[[ $(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/home/node/.n8n"}}{{.Name}}{{end}}{{end}}' "$app") == "$volume" ]]
image=$(docker inspect -f '{{.Image}}' "$db")
[[ $image == sha256:* ]]

backups=$root/backups
if [[ ! -e $backups ]]; then mkdir -m 700 "$backups"; fi
[[ -d $backups && ! -L $backups && $(stat -c '%u:%a' "$backups") == 0:700 ]]
[[ $(realpath -e "$backups") == "$backups" ]]
# Lock the existing directory, avoiding a replaceable lock-file target.
exec 9<"$backups"
flock -n 9
destination=$(mktemp -d "$backups/local-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
paused=false
restore_id=
cleanup() {
  local code=$?
  trap - EXIT
  if [[ $paused == true ]]; then docker unpause "$app" >/dev/null || code=1; fi
  if [[ -n $restore_id ]]; then docker rm -f "$restore_id" >/dev/null || code=1; fi
  if (( code != 0 )); then printf 'Backup incomplete; private artifacts retained at %s\n' "$destination" >&2; fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Pause only the new application while capturing its database and filesystem.
paused=true
docker pause "$app" >/dev/null
timeout 120 docker exec "$db" pg_dump -U n8n -d n8n -Fc >"$destination/database.dump"
tar -czf "$destination/configuration.tar.gz" -C "$root" .env compose.yaml compose.https.yaml
tar -czf "$destination/n8n-data.tar.gz" -C "$mount" .
docker unpause "$app" >/dev/null
paused=false
test -s "$destination/database.dump"
tar -tzf "$destination/configuration.tar.gz" >/dev/null
tar -tzf "$destination/n8n-data.tar.gz" >/dev/null
(
  cd "$destination"
  sha256sum database.dump configuration.tar.gz n8n-data.tar.gz >SHA256SUMS
  sha256sum -c SHA256SUMS >/dev/null
)

# Restore only into a disposable PostgreSQL with no ports, network or persistent volume.
restore_id=$(docker run -d --network none --memory 512m --cpus 0.5 --pids-limit 128 \
  --security-opt no-new-privileges:true --label descomplica.backup-verification=true \
  --tmpfs /var/lib/postgresql/data:rw,size=268435456 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=n8n -e POSTGRES_DB=n8n_restore "$image")
[[ $restore_id =~ ^[a-f0-9]{64}$ ]]
ready=false
for attempt in {1..30}; do
  if docker exec "$restore_id" pg_isready -U n8n -d n8n_restore >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ $ready == true ]]
docker cp "$destination/database.dump" "$restore_id:/tmp/database.dump"
timeout 120 docker exec "$restore_id" pg_restore --exit-on-error --no-owner --no-acl \
  -U n8n -d n8n_restore /tmp/database.dump >"$destination/restore.log" 2>&1
tables=$(docker exec "$restore_id" psql -U n8n -d n8n_restore -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
[[ $tables =~ ^[0-9]+$ && $tables -gt 0 ]]
docker rm -f "$restore_id" >/dev/null
restore_id=
printf 'database_restore=passed\ntables=%s\narchive_checksums=passed\napplication_boot=not_tested\ncredential_decryption=not_tested\noffsite=false\n' "$tables" >"$destination/verification.txt"
sync -f "$destination"
printf 'Backup verified: %s; restored tables: %s; offsite: false\n' "$destination" "$tables"
