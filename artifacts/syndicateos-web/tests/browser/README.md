# Live road-caption regression

This complements the server-rendered `venture-road-captions.test.cjs` test.
It signs in through the real client login and drives the accountant's real
project selector, `OpenPlottingModule` and `VentureLayoutMasterGrid`. No API
responses, components or authentication are mocked.

## Run

Start the existing API and original-web artifact workflows, with the API
using its existing disposable development fixture database. Then:

```sh
pnpm --filter @workspace/syndicateos-web test:roads
pnpm --filter @workspace/syndicateos-web test:roads:browser
```

The browser command uses `REPLIT_DEV_DOMAIN` plus `/syndicateos-web/`.
Outside Replit, set `SOS_BROWSER_BASE_URL` to that web preview's full URL.
Only localhost and `.replit.dev` development URLs are accepted.
Install Playwright's Chromium using `pnpm exec playwright install chromium`
from this package, or set `SOS_CHROMIUM_PATH` to an installed Chromium binary.
There is deliberately no replacement dev server in the test configuration.

The fixture connects **only** to `127.0.0.1:55439/sos_development` as `sos_test`
using the existing local trust-auth preview database. It does not read or
use customer database secrets. It creates random, isolated firm/accountant/
project/plot records in a transaction, uses a random six-digit test PIN only
in memory, and deletes those exact UUIDs in `finally`, even on assertion failure.
Do not run while another process is editing development ERP data: the strict
before/after full-row hashes will correctly flag concurrent edits too.

Coverage:
- Same mounted grid through A → B → A, plus a project with no approach width.
- Saved select-string approach widths (30/60), plot-only widths (33/40 and
  32.5/45.5), and missing plot widths without fallback.
- Foreign project exclusion and search/facing/available/reserved/sold filters,
  including filters held across project switches and zero-result searches.
- Interactive roads, split cards, blueprint-only mode and missing-plan empty
  states; split/blueprint must not retain old schematic road captions.
- No workspace/ERP mutation requests; existing projects, ERP records (including
  bookings and buyer data), settings, approvals, postings and audit rows hashed
  before and after fixture cleanup.

All screenshots/failure evidence go to ignored `generated-artifacts/road-browser`.
No authentication traces, videos or storage-state files are recorded.
