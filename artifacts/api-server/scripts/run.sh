#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export SOS_RDS_CA_FILE="${SOS_RDS_CA_FILE:-$PWD/certs/aws-rds-global-bundle.pem}"
case "${1:-start}" in
  dev) exec sh scripts/maven.sh -B spring-boot:run ;;
  start) exec java -jar target/sos-api.jar ;;
  *) echo "Usage: run.sh dev|start" >&2; exit 2 ;;
esac
