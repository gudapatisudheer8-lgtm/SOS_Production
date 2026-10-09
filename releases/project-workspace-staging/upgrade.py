#!/usr/bin/env python3
"""Run on EC2 as ubuntu after unpacking the dashboard release. No credentials saved."""
import getpass
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
jar = root / "sos-api.jar"
ca = Path("/opt/syndicateos/certs/aws-rds-global-bundle.pem")
if not jar.is_file() or not ca.is_file():
    sys.exit("Release JAR or AWS CA bundle missing. Follow DEPLOYMENT.md first.")
password = getpass.getpass("sos_migrator password (hidden): ")
if not password or "\x00" in password:
    sys.exit("A valid migrator password is required.")
env = {
    "PATH": "/usr/bin:/bin", "HOME": os.environ.get("HOME", "/home/ubuntu"), "LANG": "C.UTF-8",
    "SOS_DB_HOST": "krishisetu-db.cpmomccww28x.ap-south-1.rds.amazonaws.com",
    "SOS_DB_PORT": "5432", "SOS_DB_NAME": "SOS", "SOS_DB_USERNAME": "sos_migrator",
    "SOS_DB_PASSWORD": password, "SOS_RDS_CA_FILE": str(ca),
    "SOS_DB_READ_ONLY": "false", "SOS_ENABLE_WRITES": "false",
}
result = subprocess.run([
    "/usr/bin/java", "-Xms64m", "-Xmx256m", "-jar", str(jar),
    "--server.address=127.0.0.1", "--server.port=8091",
    "--server.tomcat.threads.max=16", "--server.tomcat.threads.min-spare=2",
    "--sos.database-name=SOS", "--sos.setup-approved=true", "--sos.upgrade-only=true",
    "--sos.setup-exit=true", "--sos.writes-enabled=false", "--sos.preview-fixture=false",
    "--spring.flyway.enabled=false", "--spring.datasource.hikari.read-only=false",
], env=env)
if result.returncode:
    sys.exit("Upgrade failed. Do not install the new runtime. Send the error output, never your password.")
print("Guarded migration finished and exited. Continue with the runtime installation in DEPLOYMENT.md.")
