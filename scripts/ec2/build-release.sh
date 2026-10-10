#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
RELEASE="sos-fresh-ec2-20261010"
OUT="$ROOT/generated-artifacts/ec2"
STAGE="$OUT/$RELEASE"
if [[ -e "$STAGE" || -e "$OUT/$RELEASE.tar.gz" ]]; then
  echo "Output already exists. Do not overwrite a shared release; use a new release name." >&2
  exit 1
fi
case "${1:-build}" in
  build)
    pnpm --filter @workspace/syndicateos-web run typecheck
    NODE_ENV=production PORT=23940 BASE_PATH=/ pnpm --filter @workspace/syndicateos-web run build
    pnpm --filter @workspace/api-server run build
    ;;
  --package-only)
    # Use only immediately after the current production outputs have been verified.
    test -f artifacts/api-server/target/sos-api.jar
    test -f artifacts/syndicateos-web/dist/public/index.html
    ;;
  *)
    echo "Usage: bash scripts/ec2/build-release.sh [--package-only]" >&2
    exit 1
    ;;
esac
mkdir -p "$STAGE/certs" "$STAGE/sql" "$STAGE/migrations"
cp artifacts/api-server/target/sos-api.jar "$STAGE/"
cp artifacts/api-server/certs/aws-rds-global-bundle.pem "$STAGE/certs/"
cp scripts/ec2/deployment.json scripts/ec2/deploy.py scripts/ec2/syndicateos-api.service \
  scripts/ec2/syndicateos-fresh.nginx.conf "$STAGE/"
cp scripts/ec2/sql/*.sql "$STAGE/sql/"
cp artifacts/api-server/src/main/resources/db/migration/*.sql "$STAGE/migrations/"
cp docs/sos-fresh-ec2-installation.md "$STAGE/README.md"
cp -R artifacts/syndicateos-web/dist/public "$STAGE/web"
python3 - "$STAGE" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
target = json.loads((root / "deployment.json").read_text())
versions = sorted(int(p.name.split("__")[0][1:]) for p in (root / "migrations").glob("V*.sql"))
assert versions == list(range(1, int(target["schema_version"]) + 1)), "Migration set mismatch"
index = (root / "web/index.html").read_text()
assert '/assets/' in index and '/syndicateos-web/' not in index, "Wrong production frontend base path"
assert 'banner-script.js' not in index and '/@vite/' not in index, "Development script in build"
(root / "web/release.json").write_text(json.dumps({
    "release": target["release"], "schema_version": target["schema_version"],
    "frontend_base": "/"
}, indent=2) + "\n")
files = sorted(p for p in root.rglob("*") if p.is_file())
(root / "FILES.sha256").write_text("".join(
    hashlib.sha256(p.read_bytes()).hexdigest() + "  " + str(p.relative_to(root)) + "\n"
    for p in files
))
PY
chmod -R a+rX "$STAGE"
tar -czf "$OUT/$RELEASE.tar.gz" -C "$OUT" "$RELEASE"
sha256sum "$OUT/$RELEASE.tar.gz"
echo "Built package: $OUT/$RELEASE.tar.gz"
