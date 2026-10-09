#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export SOS_RDS_CA_FILE="${SOS_RDS_CA_FILE:-$PWD/certs/aws-rds-global-bundle.pem}"
case "${1:-start}" in
  dev)
    if [ "${SOS_DEVELOPMENT_FIXTURE:-false}" = "true" ]; then
      sh scripts/preview-database.sh
      exec sh scripts/maven.sh -B spring-boot:run '-Dspring-boot.run.arguments=--spring.datasource.url=jdbc:postgresql://127.0.0.1:55439/sos_preview --spring.datasource.username=sos_test --spring.datasource.password= --spring.datasource.hikari.read-only=false --sos.database-name=sos_preview --sos.setup-approved=true --sos.preview-fixture=true --sos.writes-enabled=true --sos.upload-directory=/tmp/sos-preview-uploads --SOS_OWNER_MOBILE=+919888880000 --SOS_OWNER_INITIAL_PASSWORD=Preview-owner-only-123'
    fi
    exec sh scripts/maven.sh -B spring-boot:run ;;
  start) exec java -jar target/sos-api.jar ;;
  *) echo "Usage: run.sh dev|start" >&2; exit 2 ;;
esac
