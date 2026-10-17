#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077
export PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
unset NODE_OPTIONS NODE_PATH

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $EUID == 0 && $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] ||
  fail "Usage: root install-session.sh VALIDATED_RELEASE_SHA"
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || fail "Linux amd64 is required."
readonly release="/srv/descomplica-crm-releases/$1"
readonly source_dir="$release/ops/meta-ads/vps"
readonly node=/usr/local/bin/node
for command in google-chrome-stable xvfb-run xauth x11vnc tigervncpasswd systemctl systemd-analyze ss git stat realpath getent useradd runuser getfacl setfacl install cmp sed find mktemp dirname wc; do
  command -v "$command" >/dev/null || fail "A required existing host dependency is unavailable."
done
[[ $(realpath -e "$release") == "$release" ]] || fail "Release must not be a symlink."
[[ $(realpath -e "${BASH_SOURCE[0]}") == "$source_dir/install-session.sh" ]] || fail "Run the installer from the validated release."
for relative in '' ops ops/meta-ads ops/meta-ads/vps ops/salesforce; do
  directory="$release${relative:+/$relative}"
  [[ -d "$directory" && ! -L "$directory" && $(stat -c %u "$directory") == 0 ]] || fail "Release directories must be real and root-owned."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Release directories must not be group/world writable."
done
directory="$source_dir"
while [[ "$directory" != / ]]; do
  [[ $(stat -c %u "$directory") == 0 ]] || fail "Release parents must be root-owned."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Release parents must not be group/world writable."
  directory=$(dirname "$directory")
done
[[ $(git -C "$release" rev-parse HEAD) == "$1" ]] || fail "Release SHA mismatch."
[[ -z $(git -C "$release" status --porcelain --untracked-files=all) ]] || fail "Release must be clean."
[[ $(stat -c %u "$release") == 0 && $(stat -c %a "$release") =~ ^[0-7][0145][0145]$ ]] || fail "Release must be root-owned and not group/other writable."
[[ -x "$node" && $("$node" --version) == v24.19.* ]] || fail "Node 24.19.x is required at /usr/local/bin/node."
for executable in /usr/bin/google-chrome-stable /usr/bin/xvfb-run /usr/bin/Xvfb /usr/bin/xauth /usr/bin/x11vnc /usr/bin/tigervncpasswd /usr/sbin/nologin; do
  [[ -x "$executable" ]] || fail "A required fixed executable path is unavailable."
done
readonly units=(
  descomplica-meta-ads-browser.service
  descomplica-meta-ads-vnc.service
  descomplica-meta-ads-gateway.service
  descomplica-meta-ads-monitor.service
)
for relative in package.json pnpm-lock.yaml ops/meta-ads/vps/install-session.sh ops/meta-ads/console-gateway.mjs ops/meta-ads/connection-monitor.mjs ops/meta-ads/launch-dedicated-chrome.mjs ops/meta-ads/session-contract.mjs ops/salesforce/launch-dedicated-chrome.mjs ops/salesforce/browser-session.mjs ops/salesforce/private-file.mjs "${units[@]/#/ops/meta-ads/vps/}"; do
  file="$release/$relative"
  [[ -f "$file" && ! -L "$file" && $(stat -c %u "$file") == 0 ]] || fail "Expected root-owned release file is missing or a symlink."
  mode=$(stat -c %a "$file")
  (( (8#$mode & 0022) == 0 )) || fail "Release files must not be group/world writable."
  cmp -s -- "$file" <(git -C "$release" show "$1:$relative") || fail "File differs from the approved commit."
done
[[ $(find "$source_dir" -maxdepth 1 \( -name '*.service' -o -name '*.target' -o -name '*.socket' -o -name '*.timer' \) | wc -l) == "${#units[@]}" ]] || fail "Unexpected unit in release."

# Inspect dependency metadata only as root. No package code or lifecycle script runs here.
[[ -d "$release/node_modules" && ! -L "$release/node_modules" ]] || fail "Release-local node_modules required."
"$node" --input-type=module - "$release/node_modules" <<'DEPENDENCY_METADATA'
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

try {
  const root = process.argv[2];
  if (realpathSync(root) !== root) throw new Error();
  const within = (candidate) => candidate === root || candidate.startsWith(root + path.sep);
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    const info = lstatSync(current);
    if (info.uid !== 0) throw new Error();
    if (info.isSymbolicLink()) {
      // Inspect both link text and canonical target; never traverse an external store.
      const target = path.resolve(path.dirname(current), readlinkSync(current));
      if (!within(target) || !within(realpathSync(current))) throw new Error();
    } else {
      if ((info.mode & 0o022) !== 0) throw new Error();
      if (info.isDirectory()) {
        pending.push(...readdirSync(current).map((name) => path.join(current, name)));
      } else if (!info.isFile() || info.nlink !== 1) {
        throw new Error();
      }
    }
  }
  const testManifest = realpathSync(path.join(root, '@playwright/test/package.json'));
  const playwrightManifest = createRequire(testManifest).resolve('playwright/package.json');
  const coreManifest = createRequire(playwrightManifest).resolve('playwright-core/package.json');
  const manifests = [
    ['ws', path.join(root, 'ws/package.json')],
    ['zod', path.join(root, 'zod/package.json')],
    ['@playwright/test', testManifest],
    ['playwright', playwrightManifest],
    ['playwright-core', coreManifest],
  ];
  for (const [name, manifest] of manifests) {
    if (!within(realpathSync(manifest))) throw new Error();
    const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
    if (metadata.name !== name || typeof metadata.version !== 'string' || !metadata.version) throw new Error();
  }
} catch {
  console.error('Unsafe or incomplete release dependency tree.');
  process.exitCode = 1;
}
DEPENDENCY_METADATA
dependency_violations=$(find -L "$release/node_modules" \( ! -uid 0 -o -perm /0022 -o \( -type f -links +1 \) -o \( ! -type f ! -type d \) \) -printf x -quit)
[[ -z "$dependency_violations" ]] || fail "Dependencies must be root-owned private copies without group/world write."

# This installer never modifies an existing user, profile, secret or service.
! getent passwd descomplica-meta-ads >/dev/null || fail "Dedicated user already exists; inspect before updating."
! getent group descomplica-meta-ads >/dev/null || fail "Dedicated group already exists; inspect before updating."
for target in /etc/descomplica-meta-ads /var/lib/descomplica-meta-ads /run/descomplica-meta-ads /etc/systemd/system/descomplica-meta-ads-* /run/systemd/system/descomplica-meta-ads-* /usr/lib/systemd/system/descomplica-meta-ads-* /lib/systemd/system/descomplica-meta-ads-*; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "Existing installation found; inspect before updating."
done
for unit in "${units[@]}"; do
  [[ $(systemctl show --property=LoadState --value "$unit") == not-found ]] || fail "Existing systemd unit found."
done
[[ ! -e /tmp/.X101-lock && ! -L /tmp/.X101-lock && ! -e /tmp/.X11-unix/X101 && ! -L /tmp/.X11-unix/X101 ]] || fail "Display :101 is occupied."
for port in 9224 5911 6083; do
  [[ -z $(ss -H -lnt "sport = :$port") ]] || fail "A required dedicated port is occupied."
done

# Validate all rendered units before creating an account or installing services.
staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT
for unit in "${units[@]}"; do
  sed "s|@RELEASE@|$release|g" "$source_dir/$unit" > "$staging/$unit"
done
systemd-analyze verify "$staging/"*.service

trap 'printf "%s\n" "Meta Ads installation incomplete; inspect dedicated files before retrying. No service has been started." >&2' ERR
useradd --system --user-group --no-create-home --home-dir /var/lib/descomplica-meta-ads --shell /usr/sbin/nologin descomplica-meta-ads
install -d -o descomplica-meta-ads -g descomplica-meta-ads -m 0700 /var/lib/descomplica-meta-ads
install -d -o root -g root -m 0700 /etc/descomplica-meta-ads

# Grant only traversal of the existing releases parent; never widen its ACL mask.
releases_parent=/srv/descomplica-crm-releases
setfacl --no-mask --modify=user:descomplica-meta-ads:--x -- "$releases_parent"
releases_acl=$(getfacl --omit-header --absolute-names --no-effective -- "$releases_parent")
[[ $'\n'"$releases_acl"$'\n' == *$'\nuser:descomplica-meta-ads:--x\n'* ]] || fail "Meta Ads release traversal ACL is missing."
runuser -u descomplica-meta-ads -- /usr/bin/test -x "$releases_parent" || fail "Meta Ads release traversal is masked."
if runuser -u descomplica-meta-ads -- /usr/bin/test -r "$releases_parent"; then
  fail "Meta Ads must not list the releases parent."
fi
# Package code is executed only after dropping privileges, with a clean process
# environment. No browser/monitor starts: these modules have guarded entrypoints.
(cd "$release" && runuser -u descomplica-meta-ads -- /usr/bin/env -i PATH="$PATH" "$node" --input-type=module -e "if (process.getuid() === 0) throw new Error('Non-root dependency probe required'); await import('ws'); await import('@playwright/test'); await import('zod'); for (const name of ['console-gateway', 'connection-monitor', 'launch-dedicated-chrome', 'session-contract']) await import('./ops/meta-ads/' + name + '.mjs')") >/dev/null 2>&1 || fail "Dedicated user cannot load the approved release. No units were installed."

# Technical VNC password travels over stdin only. Never output credentials or
# use a Meta account password. The bearer is independent from every provider.
"$node" --input-type=module 2>/dev/null <<'NODE'
import { randomBytes } from 'node:crypto';
import { writeFileSync, chownSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const uid = Number(execFileSync('/usr/bin/id', ['-u', 'descomplica-meta-ads'], {encoding:'utf8'}));
const gid = Number(execFileSync('/usr/bin/id', ['-g', 'descomplica-meta-ads'], {encoding:'utf8'}));
const password = randomBytes(6).toString('base64');
writeFileSync('/etc/descomplica-meta-ads/operator-vnc-password', password + '\n', {mode:0o600, flag:'wx'});
const encoded = execFileSync('/usr/bin/tigervncpasswd', ['-f'], {input:password + '\n', stdio:['pipe','pipe','ignore']});
if (encoded.length !== 8) throw new Error('Unexpected VNC password format');
writeFileSync('/var/lib/descomplica-meta-ads/vnc.passwd', encoded, {mode:0o600, flag:'wx'});
chownSync('/var/lib/descomplica-meta-ads/vnc.passwd', uid, gid);
writeFileSync('/var/lib/descomplica-meta-ads/status-bearer', randomBytes(48).toString('hex') + '\n', {mode:0o600, flag:'wx'});
chownSync('/var/lib/descomplica-meta-ads/status-bearer', uid, gid);
writeFileSync('/etc/descomplica-meta-ads/monitor.env', [
  'META_ADS_STATUS_ENABLED=false',
  'META_ADS_CDP_URL=http://127.0.0.1:9224',
  'META_ADS_CRM_ORIGIN=https://crm.descomplicapro.com.br',
  'META_ADS_STATUS_SECRET_FILE=/var/lib/descomplica-meta-ads/status-bearer',
  ''
].join('\n'), {mode:0o600, flag:'wx'});
writeFileSync('/etc/descomplica-meta-ads/gateway.env', 'META_ADS_CONSOLE_ORIGIN=https://crm.descomplicapro.com.br\n', {mode:0o600, flag:'wx'});
NODE

for unit in "${units[@]}"; do
  install -o root -g root -m 0644 "$staging/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/descomplica-meta-ads-*.service
printf '%s\n' "Meta Ads installed, stopped. Pair private CRM configuration and review the runbook before activation."
