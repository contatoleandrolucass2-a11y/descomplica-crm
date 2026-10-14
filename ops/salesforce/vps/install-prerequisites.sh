#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 022
export PATH=/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 && $# == 0 ]] || exit 1
[[ $(dpkg --print-architecture) == amd64 ]] || exit 1
. /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || exit 1

key=/usr/share/keyrings/descomplica-google-chrome.asc
source=/etc/apt/sources.list.d/descomplica-google-chrome.list
[[ ! -e "$key" && ! -e "$source" ]] || {
  printf '%s\n' "Repository already configured; inspect instead of overwriting." >&2
  exit 1
}
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
  https://dl.google.com/linux/linux_signing_key.pub -o "$temporary/google.asc"
primary_fingerprints=$(gpg --batch --show-keys --with-colons "$temporary/google.asc" |
  awk -F: '$1 == "pub" { primary = 1; next } primary && $1 == "fpr" { print $10; primary = 0 }')
[[ "$primary_fingerprints" == EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796 ]] || {
  printf '%s\n' "Unexpected primary signing key; repository unchanged." >&2
  exit 1
}
install -o root -g root -m 0644 "$temporary/google.asc" "$key"
printf '%s\n' "deb [arch=amd64 signed-by=$key] https://dl.google.com/linux/chrome/deb/ stable main" > "$source"
apt-get update
# No global upgrade or service restart. Keep Chrome's native sandbox enabled.
DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y --no-install-recommends \
  google-chrome-stable xvfb xauth x11vnc novnc websockify tigervnc-tools
google-chrome-stable --version
