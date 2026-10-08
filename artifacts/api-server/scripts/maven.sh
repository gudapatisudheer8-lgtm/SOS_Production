#!/bin/sh
set -eu
# Maven honours JAVA_HOME even when PATH selects a different installed JDK.
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
exec mvn "$@"
