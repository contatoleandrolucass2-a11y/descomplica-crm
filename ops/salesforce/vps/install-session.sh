#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077
export PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $EUID == 0 && $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] ||
  fail "Usage: root install-session.sh VALIDATED_RELEASE_SHA"
release="/srv/descomplica-crm-releases/$1"
source_dir="$release/ops/salesforce/vps"
[[ $(realpath "$release") == "$release" ]] || fail "Release must not be a symlink."
[[ $(git -C "$release" rev-parse HEAD) == "$1" ]] || fail "Release SHA mismatch."
[[ -z $(git -C "$release" status --porcelain --untracked-files=no) ]] ||
  fail "Release has tracked changes."
[[ $(stat -c %u "$release") == 0 ]] || fail "Release must be root-owned."
readonly node=/usr/local/bin/node
[[ -x "$node" && $("$node" --version) == v24.19.* ]] || fail "Node 24.19.x required at /usr/local/bin/node."
for command in google-chrome-stable xvfb-run xauth x11vnc websockify tigervncpasswd systemctl; do
  command -v "$command" >/dev/null || fail "Missing prerequisite: $command"
done
[[ -r /usr/share/novnc/vnc.html ]] || fail "noVNC assets missing."
"$node" --input-type=module -e "await import('$release/node_modules/@playwright/test/index.mjs'); await import('$release/node_modules/zod/index.js')" >/dev/null
readonly units=(
  descomplica-salesforce-browser.service
  descomplica-salesforce-vnc.service
  descomplica-salesforce-web.service
  descomplica-salesforce-monitor.service
  descomplica-salesforce-console.target
)
for unit in "${units[@]}"; do
  [[ -f "$source_dir/$unit" && ! -L "$source_dir/$unit" ]] || fail "Expected unit missing or symlink."
  cmp -- "$source_dir/$unit" <(git -C "$release" show "$1:ops/salesforce/vps/$unit") ||
    fail "Unit differs from approved commit."
done
[[ $(find "$source_dir" -maxdepth 1 \( -name '*.service' -o -name '*.target' \) | wc -l) == "${#units[@]}" ]] ||
  fail "Unexpected unit in release."

# First installation only: never replace an existing profile, service or secret.
! getent passwd descomplica-salesforce >/dev/null || fail "Dedicated user already exists; inspect before updating."
for target in /etc/descomplica-salesforce /var/lib/descomplica-salesforce /run/descomplica-salesforce /etc/systemd/system/descomplica-salesforce-*; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "Existing installation found; inspect before updating."
done
[[ ! -e /tmp/.X99-lock && ! -e /tmp/.X11-unix/X99 ]] || fail "Display :99 is occupied."
for port in 9222 5909 6080; do
  [[ -z $(ss -H -lnt "sport = :$port") ]] || fail "A required loopback port is occupied."
done

useradd --system --user-group --home-dir /var/lib/descomplica-salesforce --shell /usr/sbin/nologin descomplica-salesforce
install -d -o descomplica-salesforce -g descomplica-salesforce -m 0700 /var/lib/descomplica-salesforce
install -d -o root -g descomplica-salesforce -m 0750 /etc/descomplica-salesforce

# Password goes through stdin, never process arguments, terminal or journal.
"$node" --input-type=module <<'NODE'
import { randomBytes } from 'node:crypto';
import { writeFileSync, chownSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const uid = Number(execFileSync('/usr/bin/id', ['-u', 'descomplica-salesforce'], {encoding:'utf8'}));
const gid = Number(execFileSync('/usr/bin/id', ['-g', 'descomplica-salesforce'], {encoding:'utf8'}));
const password = randomBytes(6).toString('base64');
writeFileSync('/etc/descomplica-salesforce/operator-vnc-password', password + '\n', {mode:0o600, flag:'wx'});
const encoded = execFileSync('/usr/bin/tigervncpasswd', ['-f'], {input:password + '\n', stdio:['pipe','pipe','ignore']});
if (encoded.length !== 8) throw new Error('Unexpected VNC password format');
writeFileSync('/var/lib/descomplica-salesforce/vnc.passwd', encoded, {mode:0o600, flag:'wx'});
chownSync('/var/lib/descomplica-salesforce/vnc.passwd', uid, gid);
writeFileSync('/var/lib/descomplica-salesforce/status-bearer', randomBytes(48).toString('hex') + '\n', {mode:0o600, flag:'wx'});
chownSync('/var/lib/descomplica-salesforce/status-bearer', uid, gid);
writeFileSync('/etc/descomplica-salesforce/monitor.env', [
  'SALESFORCE_STATUS_ENABLED=false',
  'SALESFORCE_CDP_URL=http://127.0.0.1:9222',
  'SALESFORCE_CRM_ORIGIN=https://crm.descomplicapro.com.br',
  'SALESFORCE_STATUS_SECRET_FILE=/var/lib/descomplica-salesforce/status-bearer',
  'SALESFORCE_N8N_PUBLISH_ENABLED=false',
  ''
].join('\n'), {mode:0o640, flag:'wx'});
chownSync('/etc/descomplica-salesforce/monitor.env', 0, gid);
NODE

for unit in "${units[@]}"; do
  destination="/etc/systemd/system/$unit"
  sed "s|@RELEASE@|$release|g" "$source_dir/$unit" > "$destination"
  chmod 0644 "$destination"
done
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/descomplica-salesforce-*.service /etc/systemd/system/descomplica-salesforce-*.target
printf '%s\n' "Installed, stopped. Review units, then enable the browser. Monitor and console remain opt-in."
