#!/usr/bin/env node
// Run manually on a trusted machine. Never commit or share the resulting file.
// Secrets are written to an exclusive, owner-only file, never stdout.
import { createECDH } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [path, subject] = process.argv.slice(2);
if (!path || !subject || !/^(mailto:|https:\/\/)[^\s"'`$\\]+$/.test(subject)) {
  console.error('Usage: node generate-web-push-credentials.mjs /secure/path/push.env mailto:your-operations-address');
  process.exit(1);
}
const pair = createECDH('prime256v1');
pair.generateKeys();
const content = [
  `SOS_WEB_PUSH_PUBLIC_KEY=${pair.getPublicKey().toString('base64url')}`,
  `SOS_WEB_PUSH_PRIVATE_KEY=${pair.getPrivateKey().toString('base64url')}`,
  `SOS_WEB_PUSH_SUBJECT=${subject}`,
  '',
].join('\n');
writeFileSync(resolve(path), content, { flag: 'wx', mode: 0o600 });
console.log('Credentials written to the requested owner-only file. Import them through Secrets or your EC2 secret environment file. Do not share this file.');
