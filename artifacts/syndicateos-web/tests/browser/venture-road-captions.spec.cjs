const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { seed, cleanup, snapshot } = require('./road-fixture.cjs');

test('signed-in mounted dashboard keeps saved roads correct through A → B → A, filters and views', async ({ page }, testInfo) => {
  const fixture = await seed();
  const errors = [];
  const mutations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Observe, do not mock: real auth, real workspace/ERP reads and real components.
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/') &&
        !['GET', 'HEAD'].includes(request.method()) &&
        !new URL(request.url()).pathname.startsWith('/api/auth/')) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  try {
    await page.goto('./');
    await page.getByPlaceholder('e.g. SC-AP').fill(fixture.code);
    await page.getByRole('button', { name: 'Verify Firm & Continue' }).click();
    await page.getByPlaceholder('Enter 10-digit mobile number').fill(fixture.mobile.slice(-10));
    // SixPin wraps decorative digit boxes in its label, so its computed label
    // is not the exact sr-only text. Member login has one password control.
    await page.locator('input[type="password"]').fill(fixture.pin);
    const loginResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/auth/login' &&
      response.request().method() === 'POST', { timeout: 45_000 });
    await page.getByRole('button', { name: 'Sign In to Dashboard' }).click();
    expect((await loginResponse).status(), 'Real client sign-in must succeed').toBe(200);
    const selector = page.locator('#accountant-project-select');
    // Wait for configuration + workspace + per-project ERP reads on the proxy.
    await expect(selector).toBeVisible({ timeout: 45_000 });
    await page.locator('#topbar-open-plotting').click();
    const grid = page.getByTestId('venture-layout-grid');
    const summary = page.getByTestId('project-layout-summary');
    const cards = grid.getByTestId('venture-plot-card');
    const card = (number) => cards.filter({ has: page.getByText(number, { exact: true }) });
    const marker = randomUUID();
    await expect(grid).toBeVisible();
    await grid.evaluate((element, value) => { element.__roadRegressionMount = value; }, marker);

    async function select(project) {
      await selector.selectOption(project.id);
      await expect(grid.getByRole('heading', { name: `${project.name} - Master Venture Plot Grid`, exact: true })).toBeVisible();
      // Prove React reused the same mounted grid; a page reload/remount masks stale state.
      expect(await grid.evaluate((element) => element.__roadRegressionMount)).toBe(marker);
      await expect(summary.locator('div').filter({ has: page.getByText('Approach Road Width', { exact: true }) }))
        .toContainText(project.details.roadWidth ? `${project.details.roadWidth} ft` : 'Not specified');
    }

    async function assertPlots(project, subset = project.plots) {
      await expect(cards).toHaveCount(subset.length);
      for (const plot of subset) {
        await expect(card(plot.plotNumber)).toBeVisible();
        await expect(card(plot.plotNumber)).toContainText(
          `Plot road width: ${plot.roadWidthFt ? `${plot.roadWidthFt} ft` : 'Width unspecified'}`,
        );
      }
      // Foreign-project sentinel numbers must never appear, including under filters.
      for (const other of fixture.projects.filter((p) => p.id !== project.id)) {
        for (const plot of other.plots) await expect(card(plot.plotNumber)).toHaveCount(0);
      }
    }

    async function assertApproach(project, mode) {
      const labels = grid.getByText(/Approach Road —/);
      if (mode === 'Interactive Grid') {
        await expect(labels).toHaveCount(2);
        for (const label of await labels.all()) {
          await expect(label).toContainText(
            `Approach Road — ${project.details.roadWidth ? `${project.details.roadWidth} ft` : 'Width unspecified'}`,
          );
        }
        await expect(grid.getByText(/Internal Sector Road — Width unspecified/)).toBeVisible();
        await expect(grid.getByText(/Internal Access Road — Width unspecified/)).toBeVisible();
      } else {
        // These views do not have schematic roads: they must not retain hidden old captions.
        await expect(labels).toHaveCount(0);
      }
      await expect(grid).not.toContainText('BLACKTOP');
      await expect(grid).not.toContainText('CONCRETE');
      await expect(grid).not.toContainText('40 Ft / 60 Ft');
    }

    const [a, b, missing] = fixture.projects;
    for (const mode of ['Interactive Grid', 'Split View', 'Sanctioned Blueprint']) {
      await grid.getByRole('button', { name: mode, exact: true }).click();
      for (const project of [a, b, a, missing, a]) {
        await select(project);
        await assertApproach(project, mode);
        if (mode === 'Sanctioned Blueprint') {
          await expect(cards).toHaveCount(0);
          await expect(grid.getByText('No plan document uploaded yet.', { exact: true })).toBeVisible();
          await expect(grid.getByRole('img')).toHaveCount(0);
          continue;
        }
        await assertPlots(project);
        if (mode === 'Split View') {
          await expect(grid.getByText(`Showing ${project.plots.length} Plots (Tap to Book):`, { exact: true })).toBeVisible();
          await expect(grid.getByText('No plan document uploaded yet.', { exact: true })).toBeVisible();
        }
      }
    }

    // Persist filters while switching through the same mounted component.
    // Each criterion changes the displayed set without changing any road measurement.
    for (const mode of ['Interactive Grid', 'Split View']) {
      await grid.getByRole('button', { name: mode, exact: true }).click();
      await grid.getByRole('button', { name: /East Facing/ }).click();
      for (const project of [a, b, a]) {
        await select(project);
        await assertPlots(project, project.plots.filter((p) => p.facing === 'East'));
        await assertApproach(project, mode);
      }
      await grid.getByRole('button', { name: /East Facing/ }).click();
      for (const status of [
        { button: /Available \(\d+\)/, value: 'available' },
        { button: /Token Booked \(\d+\)/, value: 'reserved' },
        { button: /Registered \(\d+\)/, value: 'sold' },
      ]) {
        await grid.getByRole('button', { name: status.button }).click();
        for (const project of [a, b, a]) {
          await select(project);
          await assertPlots(project, project.plots.filter((p) => p.status === status.value));
          await assertApproach(project, mode);
        }
      }
      await grid.getByRole('button', { name: /^All \(\d+\)$/ }).click();
      const search = grid.getByPlaceholder('Search Plot #, buyer, facing...');
      await search.fill('-W');
      for (const project of [a, b, a]) {
        await select(project);
        await assertPlots(project, project.plots.filter((p) => p.plotNumber.endsWith('-W')));
        await assertApproach(project, mode);
      }
      // Searching for an absent plot should not resurrect foreign-project cards.
      await search.fill('B-E');
      await select(a);
      await assertPlots(a, []);
      await select(b);
      await assertPlots(b, b.plots.filter((p) => p.plotNumber === 'B-E'));
      await select(a);
      await assertPlots(a, []);
      await search.fill('');
      await assertPlots(a);
    }
    await grid.getByRole('button', { name: 'Interactive Grid', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath('signed-in-roads.png'), fullPage: true });
    expect(errors, 'No uncaught browser errors').toEqual([]);
    expect(mutations, 'Viewing/filtering roads must never issue workspace/ERP writes').toEqual([]);
  } finally {
    // Runs even when a UI assertion fails; fail loudly if cleanup or integrity fails.
    await page.close();
    cleanup(fixture);
    expect(snapshot(), 'Existing projects, bookings and financial rows must be byte-for-byte unchanged').toEqual(fixture.before);
  }
});
