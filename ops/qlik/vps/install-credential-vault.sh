#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ $EUID == 0 && $(uname -s) == Linux ]] || fail "Root on Linux required."
[[ $# == 1 && $1 =~ ^[0-9a-f]{40}$ ]] || fail "Usage: root install-credential-vault.sh APPROVED_RELEASE_SHA"
readonly release="/srv/descomplica-crm-releases/$1"
for command in getent id stat realpath mktemp mkdir chown chmod ln rm rmdir runuser sync git cmp dirname; do
  command -v "$command" >/dev/null || fail "Missing prerequisite: $command"
done
[[ $(realpath -e "$release") == "$release" && $(realpath -e "${BASH_SOURCE[0]}") == "$release/ops/qlik/vps/install-credential-vault.sh" ]] || fail "Run the installer from the canonical approved release."
directory="$release/ops/qlik/vps"
while [[ "$directory" != / ]]; do
  [[ -d "$directory" && ! -L "$directory" && $(stat -c %u "$directory") == 0 ]] || fail "Unsafe release directory."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Writable release directory."
  directory=$(dirname "$directory")
done
[[ $(git -C "$release" rev-parse HEAD) == "$1" ]] || fail "Release SHA mismatch."
release_status=$(git -C "$release" status --porcelain --untracked-files=all)
[[ -z "$release_status" ]] || fail "Release must be clean."
for relative in ops/qlik/vps/install-credential-vault.sh ops/qlik/credential-vault.mjs; do
  file="$release/$relative"
  [[ -f "$file" && ! -L "$file" && $(stat -c %u "$file") == 0 ]] || fail "Unsafe release file."
  mode=$(stat -c %a "$file")
  (( (8#$mode & 0022) == 0 )) || fail "Writable release file."
  cmp -- "$file" <(git -C "$release" show "$1:$relative") || fail "File differs from approved commit."
done
[[ -x /usr/bin/openssl && $(stat -c %u /usr/bin/openssl) == 0 ]] || fail "Installed root-owned OpenSSL required."
getent passwd descomplica-qlik >/dev/null || fail "Dedicated Qlik user required."
qlik_uid=$(id -u descomplica-qlik)
qlik_gid=$(id -g descomplica-qlik)
[[ $qlik_uid != 0 && $qlik_gid != 0 ]] || fail "Dedicated non-root identity required."
for directory in /etc /var /var/lib; do
  [[ $(realpath -e "$directory") == "$directory" && $(stat -c %u "$directory") == 0 ]] || fail "Unsafe parent directory."
  mode=$(stat -c %a "$directory")
  (( (8#$mode & 0022) == 0 )) || fail "Writable parent directory."
done
readonly vault=/etc/descomplica-qlik
readonly qlik_home=/var/lib/descomplica-qlik
readonly credentials="$qlik_home/credentials"
[[ -d "$qlik_home" && ! -L "$qlik_home" && $(realpath -e "$qlik_home") == "$qlik_home" ]] || fail "Private Qlik home required."
[[ $(stat -c %u:%g:%a "$qlik_home") == "$qlik_uid:$qlik_gid:700" ]] || fail "Unsafe Qlik home permissions."
for target in "$vault" "$credentials"; do
  [[ ! -e "$target" && ! -L "$target" ]] || fail "Existing vault state; inspect manually."
done

# Exclusive directories refuse partial installs. Never delete existing vault material on failure.
mkdir -m 0700 -- "$vault"
staging=$(mktemp -d "$vault/.keys.XXXXXX")
trap 'rm -f -- "$staging/private.pem" "$staging/vault-public.pem"; rmdir -- "$staging"' EXIT
/usr/bin/env -i PATH="$PATH" OPENSSL_CONF=/dev/null /usr/bin/openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "$staging/private.pem" >/dev/null 2>&1 || fail "Private key generation failed."
/usr/bin/env -i PATH="$PATH" OPENSSL_CONF=/dev/null /usr/bin/openssl pkey -in "$staging/private.pem" -pubout -out "$staging/vault-public.pem" >/dev/null 2>&1 || fail "Public key generation failed."
chmod 0600 "$staging/private.pem"
chmod 0644 "$staging/vault-public.pem"
chown "root:$qlik_gid" "$staging/private.pem" "$staging/vault-public.pem"
sync -f "$staging/private.pem"
sync -f "$staging/vault-public.pem"
ln -- "$staging/private.pem" "$vault/private.pem"
ln -- "$staging/vault-public.pem" "$vault/vault-public.pem"
rm -- "$staging/private.pem" "$staging/vault-public.pem"
chown "root:$qlik_gid" "$vault"
chmod 0750 "$vault"
runuser -u descomplica-qlik -- /usr/bin/mkdir -m 0700 -- "$credentials"
[[ ! -L "$credentials" && $(realpath -e "$credentials") == "$credentials" && $(stat -c %u:%g:%a "$credentials") == "$qlik_uid:$qlik_gid:700" ]] || fail "Unsafe credential directory."
sync -f "$vault"
sync -f "$credentials"
sync -f /etc
sync -f "$qlik_home"
printf '%s\n' "Credential vault prepared. No credentials saved and no consumer enabled."
