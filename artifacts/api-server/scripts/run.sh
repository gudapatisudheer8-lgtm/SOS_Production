#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export SOS_RDS_CA_FILE="${SOS_RDS_CA_FILE:-$PWD/certs/aws-rds-global-bundle.pem}"
case "${1:-start}" in
  dev)
    if [ "${SOS_DEVELOPMENT_FIXTURE:-false}" = "true" ]; then
      sh scripts/preview-database.sh
      # Keep private preview files across workflow/workspace restarts. Preserve
      # files uploaded under the previous temporary directory without changing IDs.
      (
        umask 077
        mkdir -p "$PWD/../../.local/state/sos-preview-uploads"
        if [ -d /tmp/sos-development-uploads ]; then
          cp -an /tmp/sos-development-uploads/. "$PWD/../../.local/state/sos-preview-uploads/"
        fi
      )
      exec sh scripts/maven.sh -B spring-boot:run "-Dspring-boot.run.arguments=--spring.datasource.url=jdbc:postgresql://127.0.0.1:55439/sos_development --spring.datasource.username=sos_test --spring.datasource.password= --spring.datasource.hikari.read-only=false --sos.database-name=sos_development --sos.setup-approved=true --sos.preview-fixture=false --sos.writes-enabled=true --sos.upload-directory=$PWD/../../.local/state/sos-preview-uploads"
    fi
    exec sh scripts/maven.sh -B spring-boot:run ;;
  start) exec java -jar target/sos-api.jar ;;
  *) echo "Usage: run.sh dev|start" >&2; exit 2 ;;
esac
