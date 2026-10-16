#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077
export PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
unset NODE_OPTIONS NODE_PATH

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $EUID == 0 && $(uname -s) == Linux ]] || fail "Root on Linux is required."
[[ $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || fail "Usage: root install-session.sh VALIDATED_RELEASE_SHA"
readonly release="/srv/descomplica-crm-releases/$1"
readonly source_dir="$release/ops/qlik/vps"
readonly node=/usr/local/bin/node
readonly units=(
  descomplica-qlik-browser.service
  descomplica-qlik-vnc.service
  descomplica-qlik-console.service
)

for command in realpath git stat find cmp getent getfacl setfacl ss useradd runuser install mktemp sed dirname wc systemctl systemd-analyze; do
  command -v "$command" >/dev/null || fail "Missing prerequisite: $command"
done
[[ $(realpath -e "$release") == "$release" ]] || fail "Release path must be canonical."
[[ $(realpath -e "${BASH_SOURCE[0]}") == "$source_dir/install-session.sh" ]] ||
  fail "Run the installer from the validated release."
# Every parent of executable release inputs must resist unprivileged replacement.
for relative in '' ops ops/qlik ops/qlik/vps ops/qlik/console scripts scripts/release; do
  directory="$release${relative:+/$relative}"
  [[ -d "$directory" && ! -L "$directory" ]] || fail "Invalid release directory."
  [[ $(stat -c %u "$directory") == 0 ]] || fail "Release directories must be root-owned."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Release directories must not be group/world writable."
done
directory="$source_dir"
while [[ "$directory" != / ]]; do
  [[ $(stat -c %u "$directory") == 0 ]] || fail "Release directories must be root-owned."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Release directories must not be group/world writable."
  directory=$(dirname "$directory")
done
[[ $(git -C "$release" rev-parse HEAD) == "$1" ]] || fail "Release SHA mismatch."
release_status=$(git -C "$release" status --porcelain --untracked-files=all)
[[ -z "$release_status" ]] || fail "Release must be clean."
for relative in ops/qlik/vps/install-session.sh ops/qlik/console-gateway.mjs ops/qlik/credential-vault.mjs ops/qlik/launch-browser.mjs ops/qlik/status-monitor.mjs lib/crm/qlik/status-contract.ts ops/qlik/browser-login.mjs ops/qlik/login-credential.mjs ops/qlik/prepare-login-credential.mjs ops/qlik/login-attempt.mjs scripts/release/private-json-store.mjs scripts/release/production-release-lock.mjs ops/qlik/browser-preflight.mjs ops/qlik/collection-loop.mjs ops/qlik/metadata-artifact.mjs ops/qlik/qix-metadata.mjs ops/qlik/console/index.html ops/qlik/console/client.js ops/qlik/console/credential-client.js ops/qlik/console/style.css "${units[@]/#/ops/qlik/vps/}"; do
  file="$release/$relative"
  [[ -f "$file" && ! -L "$file" && $(stat -c %u "$file") == 0 ]] ||
    fail "Expected root-owned release file missing or symlink."
  mode=$(stat -c %a "$file")
  (( (8#$mode & 0022) == 0 )) || fail "Release files must not be group/world writable."
  cmp -- "$file" <(git -C "$release" show "$1:$relative") || fail "File differs from approved commit."
done
[[ $(find "$source_dir" -maxdepth 1 \( -name '*.service' -o -name '*.target' -o -name '*.socket' -o -name '*.timer' \) | wc -l) == "${#units[@]}" ]] ||
  fail "Unexpected unit in release."

[[ -x "$node" && $("$node" --version) == v24.19.* ]] || fail "Node 24.19.x required at /usr/local/bin/node."
for executable in /usr/bin/google-chrome-stable /usr/bin/xvfb-run /usr/bin/Xvfb /usr/bin/xauth /usr/bin/x11vnc /usr/sbin/nologin; do
  [[ -x "$executable" ]] || fail "Required executable missing."
done
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
    ['enigma.js', path.join(root, 'enigma.js/package.json')],
    ['@novnc/novnc', path.join(root, '@novnc/novnc/package.json')],
    ['@playwright/test', testManifest],
    ['playwright', playwrightManifest],
    ['playwright-core', coreManifest],
  ];
  for (const [name, manifest] of manifests) {
    if (!within(realpathSync(manifest))) throw new Error();
    const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
    if (metadata.name !== name || typeof metadata.version !== 'string' || !metadata.version) throw new Error();
    if (name === 'enigma.js' && metadata.version !== '2.15.0') throw new Error();
  }
} catch {
  console.error('Unsafe or incomplete release dependency tree.');
  process.exitCode = 1;
}
DEPENDENCY_METADATA
dependency_violations=$(find -L "$release/node_modules" \( ! -uid 0 -o -perm /0022 -o \( -type f -links +1 \) -o \( ! -type f ! -type d \) \) -printf x -quit)
[[ -z "$dependency_violations" ]] || fail "Dependencies must be root-owned private copies without group/world write."
# x11vnc -help exits nonzero on some packaged versions.
vnc_help=$(/usr/bin/x11vnc -help 2>&1 || true)
for flag in -unixsock -rfbport -rfbportv6 -nosel -noprimary -nosetprimary -noclipboard -nosetclipboard; do
  [[ "$vnc_help" == *"$flag "* ]] || fail "Installed x11vnc lacks a required option."
done
unset vnc_help

! getent passwd descomplica-qlik >/dev/null || fail "Dedicated user already exists; inspect before updating."
! getent group descomplica-qlik >/dev/null || fail "Dedicated group already exists; inspect before updating."
for target in /etc/descomplica-qlik /var/lib/descomplica-qlik /run/descomplica-qlik /etc/systemd/system/descomplica-qlik* /run/systemd/system/descomplica-qlik* /usr/lib/systemd/system/descomplica-qlik* /lib/systemd/system/descomplica-qlik*; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "Existing installation found; inspect before updating."
done
for unit in "${units[@]}"; do
  [[ $(systemctl show --property=LoadState --value "$unit") == not-found ]] || fail "Existing systemd unit found."
done
for target in /tmp/.X98-lock /tmp/.X11-unix/X98; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "Display :98 is occupied."
done
unix_listeners=$(ss -H -lx)
[[ "$unix_listeners" != *'/tmp/.X11-unix/X98 '* && "$unix_listeners" != *'/run/descomplica-qlik/'* ]] ||
  fail "A required UNIX socket is occupied."

# Verify rendered units before creating the account or installing any service.
staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT
for unit in "${units[@]}"; do
  sed "s|@RELEASE@|$release|g" "$source_dir/$unit" > "$staging/$unit"
done
systemd-analyze verify "$staging/"*.service

useradd --system --user-group --no-create-home --home-dir /var/lib/descomplica-qlik --shell /usr/sbin/nologin descomplica-qlik
install -d -o descomplica-qlik -g descomplica-qlik -m 0700 /var/lib/descomplica-qlik /var/lib/descomplica-qlik/chrome
# Traverse a known release path without listing the parent or changing other ACL entries/mask.
releases_parent=/srv/descomplica-crm-releases
setfacl --no-mask --modify=user:descomplica-qlik:--x -- "$releases_parent"
releases_acl=$(getfacl --omit-header --absolute-names --no-effective -- "$releases_parent")
[[ $'\n'"$releases_acl"$'\n' == *$'\nuser:descomplica-qlik:--x\n'* ]] || fail "Qlik release traversal ACL missing."
runuser -u descomplica-qlik -- /usr/bin/test -x "$releases_parent" || fail "Qlik release traversal is masked."
if runuser -u descomplica-qlik -- /usr/bin/test -r "$releases_parent"; then
  fail "Qlik must not list the releases parent."
fi
# A failed non-root probe leaves the account/profile for manual inspection, with no units installed.
(cd "$release" && runuser -u descomplica-qlik -- /usr/bin/env -i PATH="$PATH" HOME=/var/lib/descomplica-qlik "$node" --input-type=module -e "import { access } from 'node:fs/promises'; if (process.getuid() === 0) throw new Error('Non-root dependency probe required'); await import('ws'); await import('@playwright/test'); await access(new URL(import.meta.resolve('@novnc/novnc'))); for (const name of ['browser-login', 'login-credential', 'prepare-login-credential', 'login-attempt']) await import('./ops/qlik/' + name + '.mjs'); const { getBrowserMetadataScript } = await import('./ops/qlik/browser-preflight.mjs'); await getBrowserMetadataScript()") >/dev/null
for unit in "${units[@]}"; do
  install -o root -g root -m 0644 "$staging/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
printf '%s\n' "Installed, stopped and disabled. Start the private console only on demand after review."
