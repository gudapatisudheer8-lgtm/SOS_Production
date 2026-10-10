#!/usr/bin/env python3
"""Phased EC2 installation. No AWS access occurs when building the package."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import socket
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
TARGET = json.loads((ROOT / "deployment.json").read_text())
HOME = Path("/opt/syndicateos")
CURRENT = HOME / "current"
ENV_FILE = Path("/etc/syndicateos/runtime.env")
UPLOADS = Path("/var/lib/syndicateos/uploads")
SERVICE = "syndicateos-api"


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def require_root():
    if os.geteuid() != 0:
        sys.exit("Use sudo for this step. No changes made.")


def require_tools(*tools):
    for tool in tools:
        if not shutil.which(tool):
            sys.exit(f"Missing {tool}. Install the prerequisites in README.md first.")


def verify_package():
    manifest = ROOT / "FILES.sha256"
    if not manifest.is_file():
        sys.exit("Not an assembled release. Run this script from the verified archive.")
    for line in manifest.read_text().splitlines():
        expected, name = line.split("  ", 1)
        file = (ROOT / name).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            sys.exit("Unsafe or missing release file. No changes made.")
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            sys.exit(f"Release file checksum mismatch: {name}. No changes made.")


def clean_environment():
    return {"PATH": "/usr/bin:/bin", "HOME": "/root", "LANG": "C.UTF-8"}


def db_environment(username, password):
    return {
        **clean_environment(), "PGHOST": TARGET["database_host"],
        "PGPORT": TARGET["database_port"], "PGDATABASE": TARGET["database_name"],
        "PGUSER": username, "PGPASSWORD": password, "PGSSLMODE": "verify-full",
        "PGSSLROOTCERT": str(CURRENT / "certs/aws-rds-global-bundle.pem"),
        "PGCONNECT_TIMEOUT": "10",
    }


def sql(username, password, *, query=None, file=None, capture=False):
    args = ["/usr/bin/psql", "-X", "-v", "ON_ERROR_STOP=1"]
    args += ["-tA", "-c", query] if query else ["-f", str(file)]
    return run(args, env=db_environment(username, password),
               text=True, capture_output=capture).stdout


def secret(prompt, minimum=1):
    value = getpass.getpass(prompt + " (hidden): ")
    if len(value) < minimum or any(c in value for c in "\r\n\0"):
        sys.exit(f"Input must contain at least {minimum} characters and no line breaks.")
    return value


def require_staged():
    if CURRENT.resolve() != ROOT:
        sys.exit("Run this step using /opt/syndicateos/current/deploy.py after staging.")
    verify_package()


def require_api_stopped():
    active = subprocess.run(["systemctl", "is-active", "--quiet", SERVICE])
    if active.returncode == 0:
        sys.exit("Stop syndicateos-api before initialization; no database changes made.")


def inspect():
    require_tools("java", "psql", "nginx", "systemctl", "curl")
    run(["java", "-version"])
    run(["df", "-h", "/"])
    run(["free", "-h"])
    # Print configuration PATHS, not environment values or credential files.
    subprocess.run(["systemctl", "show", SERVICE, "-p", "LoadState", "-p", "FragmentPath",
                    "-p", "DropInPaths", "-p", "EnvironmentFiles", "-p", "User"])
    run(["nginx", "-t"])
    print("Target:", json.dumps(TARGET, indent=2))
    print("Inspect complete. No application files or database records changed.")


def stage():
    require_root()
    verify_package()
    require_tools("java", "psql", "nginx", "systemctl", "curl", "useradd")
    version = subprocess.check_output(["java", "-version"], stderr=subprocess.STDOUT).decode()
    if 'version "21.' not in version:
        sys.exit("Java 21 is required. No changes made.")
    if shutil.disk_usage("/opt").free < 250 * 1024 * 1024:
        sys.exit("At least 250 MB free on /opt is required, plus space for backups.")
    run(["nginx", "-t"])
    if HOME.is_symlink() or UPLOADS.is_symlink():
        sys.exit("Unexpected symlink at the install/upload directory. Stop and inspect.")
    if ROOT.is_relative_to(HOME):
        sys.exit("Stage from the extracted archive in /home/ubuntu, not the active install.")
    account = None
    try:
        account = pwd.getpwnam("syndicateos")
    except KeyError:
        pass
    if account is not None and (account.pw_uid == 0 or account.pw_uid >= 1000):
        sys.exit("Existing syndicateos user is not a dedicated system user. Stop and review.")
    answer = input("This stops SOS and archives its old deployment. Type INSTALL FRESH SOS: ")
    if answer != "INSTALL FRESH SOS":
        sys.exit("Cancelled. No changes made.")

    backup = Path("/opt/syndicateos-archives") / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup.mkdir(parents=True, mode=0o700)
    backup.parent.chmod(0o700)
    # Archive configuration before stopping anything. Protected copies may contain secrets.
    with tarfile.open(backup / "server-config.tar.gz", "w:gz") as archive:
        for name in ("/etc/nginx", "/etc/syndicateos", "/etc/syndicateos.env",
                     "/etc/systemd/system/syndicateos-api.service",
                     "/etc/systemd/system/syndicateos-api.service.d"):
            if Path(name).exists():
                archive.add(name, arcname=name.lstrip("/"))
    load_state = subprocess.run(
        ["systemctl", "show", SERVICE, "-p", "LoadState", "--value"],
        capture_output=True, text=True).stdout.strip()
    if load_state != "not-found":
        run(["systemctl", "stop", SERVICE])
    if HOME.exists():
        HOME.rename(backup / "old-install")
    dropins = Path("/etc/systemd/system/syndicateos-api.service.d")
    if dropins.exists():
        dropins.rename(backup / "old-service-dropins")
    if Path("/etc/syndicateos").exists():
        Path("/etc/syndicateos").rename(backup / "old-environment")

    release = HOME / "releases" / TARGET["release"]
    shutil.copytree(ROOT, release)
    CURRENT.symlink_to(release, target_is_directory=True)
    if account is None:
        run(["useradd", "--system", "--user-group", "--home-dir", "/var/lib/syndicateos",
             "--no-create-home", "--shell", "/usr/sbin/nologin", "syndicateos"])
    UPLOADS.mkdir(parents=True, exist_ok=True, mode=0o750)
    run(["chown", "-R", "syndicateos:syndicateos", str(UPLOADS)])
    UPLOADS.chmod(0o750)
    ENV_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    ENV_FILE.parent.chmod(0o700)
    shutil.copyfile(ROOT / "syndicateos-api.service",
                    "/etc/systemd/system/syndicateos-api.service")
    Path("/etc/systemd/system/syndicateos-api.service").chmod(0o644)
    snippets = Path("/etc/nginx/snippets")
    snippets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "syndicateos-fresh.nginx.conf", snippets / "syndicateos-fresh.conf")
    run(["systemctl", "daemon-reload"])
    print(f"Staged {TARGET['release']}. Backup: {backup}")
    print("Existing /var/lib/syndicateos/uploads was preserved.")
    print("SOS remains STOPPED. Continue with configure, database initialization, then Nginx.")


def configure():
    require_root()
    require_staged()
    password = secret("sos_runtime database password", minimum=16)
    values = {
        "SOS_DB_HOST": TARGET["database_host"], "SOS_DB_PORT": TARGET["database_port"],
        "SOS_DB_NAME": TARGET["database_name"], "SOS_DB_USERNAME": TARGET["runtime_role"],
        "SOS_DB_PASSWORD": password,
        "SOS_RDS_CA_FILE": str(CURRENT / "certs/aws-rds-global-bundle.pem"),
        "SOS_DB_READ_ONLY": "false", "SOS_ENABLE_WRITES": "true",
        "SOS_ALLOWED_ORIGINS": "https://" + TARGET["domain"],
    }
    def quote(value):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    temporary = ENV_FILE.with_suffix(".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as output:
        for key, value in values.items():
            output.write(key + "=" + quote(value) + "\n")
    temporary.chmod(0o600)
    temporary.replace(ENV_FILE)
    print("Protected runtime configuration saved. No password values displayed.")


def initialize():
    require_root()
    require_staged()
    require_api_stopped()
    require_tools("java", "psql")
    migrator = secret("sos_deploy database password", minimum=16)
    actual = sql(TARGET["migration_role"], migrator, query="SELECT current_database()", capture=True)
    if actual.strip() != TARGET["database_name"]:
        sys.exit("Database target mismatch; no migration performed.")
    mobile = input("Owner mobile including country code (for example +91...): ").strip()
    owner_password = secret("Initial owner password", minimum=8)
    if len(owner_password.encode("utf-8")) > 72:
        sys.exit("Owner password exceeds the supported 72 UTF-8 bytes.")
    if input("Type INITIALIZE sos to approve migration of the confirmed target: ") != "INITIALIZE sos":
        sys.exit("Cancelled. No migration performed.")
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", 8091))
        except OSError:
            sys.exit("Port 8091 is already in use. No migration performed.")
    env = {
        **clean_environment(), "SOS_DB_HOST": TARGET["database_host"],
        "SOS_DB_PORT": TARGET["database_port"], "SOS_DB_NAME": TARGET["database_name"],
        "SOS_DB_USERNAME": TARGET["migration_role"], "SOS_DB_PASSWORD": migrator,
        "SOS_RDS_CA_FILE": str(CURRENT / "certs/aws-rds-global-bundle.pem"),
        "SOS_DB_READ_ONLY": "false", "SOS_ENABLE_WRITES": "false",
        "SOS_OWNER_MOBILE": mobile, "SOS_OWNER_INITIAL_PASSWORD": owner_password,
    }
    run(["/usr/bin/java", "-Xms64m", "-Xmx256m", "-jar", str(CURRENT / "sos-api.jar"),
         "--server.address=127.0.0.1", "--server.port=8091",
         "--server.tomcat.threads.max=16", "--server.tomcat.threads.min-spare=2",
         "--sos.setup-approved=true", "--sos.setup-exit=true",
         "--sos.writes-enabled=false", "--sos.preview-fixture=false",
         "--spring.flyway.enabled=false", "--spring.datasource.hikari.read-only=false"],
        env=env, timeout=300, cwd=CURRENT)
    sql(TARGET["migration_role"], migrator, file=ROOT / "sql/02_runtime_permissions.sql")
    print("Migrations and owner setup completed; runtime privileges applied.")
    print("No sample firms, projects, users, or transactions were imported.")


def local_https(path):
    return subprocess.check_output([
        "/usr/bin/curl", "--fail", "--silent", "--show-error", "--max-time", "15",
        "--noproxy", "*",
        "--resolve", f"{TARGET['domain']}:443:127.0.0.1",
        f"https://{TARGET['domain']}{path}",
    ], text=True)


def activate():
    require_root()
    require_staged()
    if not ENV_FILE.is_file() or ENV_FILE.stat().st_mode & 0o077:
        sys.exit("Protected runtime.env is missing or accessible to other users.")
    run(["nginx", "-t"])
    run(["systemctl", "reset-failed", SERVICE])
    run(["systemctl", "start", SERVICE])
    # Check database-backed readiness, not only HTTP process health.
    for _ in range(45):
        result = subprocess.run(
            ["/usr/bin/curl", "--fail", "--silent", "--max-time", "3", "--noproxy", "*",
             "http://127.0.0.1:8080/api/readyz"], capture_output=True, text=True)
        if result.returncode == 0:
            try:
                if json.loads(result.stdout).get("status") == "ready":
                    break
            except json.JSONDecodeError:
                pass
        time.sleep(2)
    else:
        run(["systemctl", "stop", SERVICE])
        sys.exit("API readiness failed; SOS stopped. Inspect journalctl; do not rerun SQL blindly.")
    try:
        run(["systemctl", "reload", "nginx"])
        release = json.loads(local_https("/release.json"))
        readiness = json.loads(local_https("/api/readyz"))
        if release.get("release") != TARGET["release"] or readiness.get("status") != "ready":
            raise ValueError("HTTPS routes do not serve the expected release/API.")
    except (subprocess.CalledProcessError, json.JSONDecodeError, ValueError):
        run(["systemctl", "stop", SERVICE])
        sys.exit("HTTPS verification failed; SOS stopped. Inspect the SOS Nginx block.")
    run(["systemctl", "enable", SERVICE])
    print(f"HTTPS routing and runtime readiness passed for {TARGET['release']}.")
    print("Client: https://" + TARGET["domain"] + "/")
    print("Owner:  https://" + TARGET["domain"] + "/owner")
    print("Now complete the signed-in acceptance checklist in README.md.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("inspect", "stage", "configure", "initialize", "activate"))
    phase = parser.parse_args().phase
    globals()[phase]()


if __name__ == "__main__":
    try:
        main()
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired,
            json.JSONDecodeError, ValueError) as error:
        sys.exit(f"Installation stopped: {error}. Fix this phase before continuing; no automatic rollback.")
