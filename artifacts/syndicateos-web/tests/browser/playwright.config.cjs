const path = require('node:path');
const { defineConfig } = require('@playwright/test');

// Deliberately no webServer: use the artifact-managed web/API workflows.
const baseURL = process.env.SOS_BROWSER_BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}/syndicateos-web/`);
if (!baseURL) throw new Error('Set SOS_BROWSER_BASE_URL to the running original web preview URL.');
const url = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) && !url.hostname.endsWith('.replit.dev')) {
  throw new Error('Browser regression is restricted to local/development previews, never production.');
}

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'venture-road-captions.spec.cjs',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: path.resolve(__dirname, '../../../../generated-artifacts/road-browser/results'),
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    // No traces or videos: they can retain test authentication material.
    trace: 'off',
    video: 'off',
    ...(process.env.SOS_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.SOS_CHROMIUM_PATH } } : {}),
  },
});
