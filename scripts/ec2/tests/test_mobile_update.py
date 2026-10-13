"""Isolated filesystem checks. Never contacts EC2 or executes Nginx/systemctl."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("mobile_update", Path(__file__).parents[1] / "mobile-update.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

class MobileUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.package = self.root / "package"
        (self.package / "mobile").mkdir(parents=True)
        self.base = self.root / "opt"
        self.base.mkdir()
        self.main = self.root / "syndicateos-fresh.conf"
        self.original = "root /opt/syndicateos/current/web;\nlocation /api/ { proxy_pass http://127.0.0.1:8080; }\n"
        self.main.write_text(self.original)
        self.meta = {"release": "isolated-mobile-test", "existingWebRelease": {"schema_version": "22"},
                     "verifyAssets": ["asset.js"]}
        (self.package / "mobile/release.json").write_text(json.dumps(self.meta))
        (self.package / "mobile/index.html").write_text('<script src="/mobile/_expo/entry.js"></script>')
        (self.package / "mobile/asset.js").write_text("test asset")
        (self.package / "mobile.nginx.conf").write_text("# mobile routing only")
        self.manifest = {str(p.relative_to(self.package)): hashlib.sha256(p.read_bytes()).hexdigest()
                         for p in self.package.rglob("*") if p.is_file()}
        (self.package / "manifest.json").write_text(json.dumps(self.manifest))
        self.commands = []
        self.active = False
        self.fail_verify = False
        self.mismatch = False
        self.backup = self.root / "backup"
        # Override only the backup-path factory; ordinary pathlib operations stay real and isolated.
        real_path = Path
        def path(value):
            if str(value).startswith("/var/backups/syndicateos-mobile"):
                return self.backup
            return real_path(value)
        self.patches = [
            patch.object(installer, "ROOT", self.package),
            patch.object(installer, "BASE", self.base),
            patch.object(installer, "MAIN", self.main),
            patch.object(installer, "MOBILE", self.root / "mobile.conf"),
            patch.object(installer, "LINK", self.base / "mobile-current"),
            patch.object(installer, "Path", path),
            patch.object(installer, "run", self.fake_run),
            patch.object(installer, "get", self.get),
            patch.object(installer.time, "sleep", lambda _: None),
            patch.object(installer.os, "geteuid", lambda: 0),
            patch.object(sys, "argv", ["install.py", "install"]),
        ]
        for item in self.patches:
            item.start()
    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()
    def fake_run(self, *args):
        self.commands.append(args)
        if args == ("nginx", "-T"):
            return "# configuration file /etc/nginx/snippets/syndicateos-fresh.conf:"
        if args == ("systemctl", "reload", "nginx"):
            self.active = installer.LINK.is_symlink()
        return ""
    def get(self, path):
        if path == "/api/readyz":
            return b'{"status":"ready"}'
        if path == "/release.json":
            return json.dumps({"schema_version": "wrong"} if self.mismatch else self.meta["existingWebRelease"]).encode()
        if self.fail_verify:
            raise RuntimeError("isolated verification failure")
        if not self.active:
            raise RuntimeError("Mobile not activated")
        if path == "/mobile/":
            return (self.package / "mobile/index.html").read_bytes()
        return (self.package / path.lstrip("/")).read_bytes()
    def test_install_preserves_existing_routes_and_does_not_restart_api(self):
        installer.main()
        self.assertTrue(self.main.read_text().startswith(self.original))
        self.assertEqual(self.main.read_text().count(installer.INCLUDE), 1)
        self.assertEqual(installer.LINK.resolve(), self.base / "mobile-releases/isolated-mobile-test")
        self.assertFalse(any("syndicateos-api" in command for command in self.commands))
        self.assertEqual(len(list(self.backup.rglob("state.json"))), 1)
    def test_checksum_failure_changes_no_routes(self):
        (self.package / "mobile/asset.js").write_text("tampered")
        with self.assertRaisesRegex(RuntimeError, "Package verification"):
            installer.main()
        self.assertEqual(self.main.read_text(), self.original)
        self.assertFalse(installer.LINK.is_symlink())
    def test_baseline_failure_changes_no_routes(self):
        self.mismatch = True
        with self.assertRaisesRegex(RuntimeError, "differs"):
            installer.main()
        self.assertEqual(self.main.read_text(), self.original)
        self.assertFalse(self.backup.exists())
    def test_failed_activation_restores_original_routes(self):
        self.fail_verify = True
        with self.assertRaisesRegex(RuntimeError, "verification failure"):
            installer.main()
        self.assertEqual(self.main.read_text(), self.original)
        self.assertFalse(installer.LINK.is_symlink())
        self.assertFalse(installer.MOBILE.exists())
    def test_restore_previous_mobile_link_and_snippet(self):
        previous = self.base / "previous"
        previous.mkdir()
        installer.LINK.symlink_to(previous)
        installer.MOBILE.write_text("prior mobile routes")
        installer.main()
        installer.restore(next(self.backup.rglob("state.json")).parent)
        self.assertEqual(installer.LINK.resolve(), previous)
        self.assertEqual(installer.MOBILE.read_text(), "prior mobile routes")
        self.assertEqual(self.main.read_text(), self.original)

if __name__ == "__main__":
    unittest.main()
