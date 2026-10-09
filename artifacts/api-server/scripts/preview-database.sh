#!/bin/sh
set -eu
# Disposable development data only, bound to loopback. No customer RDS credentials.
STATE="$(pwd)/../../.local/state/sos-preview-pg"
if [ ! -f "$STATE/PG_VERSION" ]; then
  mkdir -p "$STATE"
  initdb -D "$STATE" -U sos_test -A trust >/dev/null
fi
if ! pg_isready -h 127.0.0.1 -p 55439 >/dev/null 2>&1; then
  if [ -f "$STATE/postmaster.pid" ]; then
    PID="$(head -n 1 "$STATE/postmaster.pid")"
    EXE="$(readlink "/proc/$PID/exe" 2>/dev/null || true)"
    case "$EXE" in
      */postgres) echo "Preview PostgreSQL is running but not ready; inspect its log." >&2; exit 1 ;;
      *) rm -f "$STATE/postmaster.pid" "$STATE/.s.PGSQL.55439.lock" ;;
    esac
  fi
  pg_ctl -D "$STATE" -l "$STATE/server.log" -o "-p 55439 -h 127.0.0.1 -k $STATE" -w start
fi
if ! psql -h 127.0.0.1 -p 55439 -U sos_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sos_development'" | grep -q 1; then
  createdb -h 127.0.0.1 -p 55439 -U sos_test sos_development
fi
