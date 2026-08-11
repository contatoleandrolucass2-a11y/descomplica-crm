#!/bin/sh
set -eu

chain="DESCOMPLICA_HOMOLOGATION"
port_range="55320:55329"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "homologation firewall requires root" >&2
    exit 1
  fi
}

apply_family() {
  command_name="$1"
  loopback_source="$2"

  "$command_name" -n -L DOCKER-USER >/dev/null 2>&1
  "$command_name" -N "$chain" 2>/dev/null || true
  "$command_name" -F "$chain"
  "$command_name" -A "$chain" -p tcp -s "$loopback_source" \
    -m conntrack --ctdir ORIGINAL --ctorigdstport "$port_range" -j RETURN
  "$command_name" -A "$chain" -p tcp \
    -m conntrack --ctdir ORIGINAL --ctorigdstport "$port_range" -j DROP
  "$command_name" -A "$chain" -j RETURN
  "$command_name" -C DOCKER-USER -j "$chain" 2>/dev/null || \
    "$command_name" -I DOCKER-USER 1 -j "$chain"
}

check_family() {
  command_name="$1"
  loopback_source="$2"

  "$command_name" -C DOCKER-USER -j "$chain" >/dev/null 2>&1
  "$command_name" -C "$chain" -p tcp -s "$loopback_source" \
    -m conntrack --ctdir ORIGINAL --ctorigdstport "$port_range" -j RETURN >/dev/null 2>&1
  "$command_name" -C "$chain" -p tcp \
    -m conntrack --ctdir ORIGINAL --ctorigdstport "$port_range" -j DROP >/dev/null 2>&1
}

remove_family() {
  command_name="$1"
  while "$command_name" -C DOCKER-USER -j "$chain" >/dev/null 2>&1; do
    "$command_name" -D DOCKER-USER -j "$chain"
  done
  "$command_name" -F "$chain" 2>/dev/null || true
  "$command_name" -X "$chain" 2>/dev/null || true
}

require_root
case "${1:-}" in
  apply)
    apply_family iptables 127.0.0.1/32
    apply_family ip6tables ::1/128
    ;;
  check)
    check_family iptables 127.0.0.1/32
    check_family ip6tables ::1/128
    ;;
  remove)
    remove_family iptables
    remove_family ip6tables
    ;;
  *)
    echo "usage: $0 apply|check|remove" >&2
    exit 2
    ;;
esac
