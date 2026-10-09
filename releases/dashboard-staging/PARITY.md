# SyndicateOS dashboard parity inventory

Source: https://github.com/gudapatisudheer8-lgtm/SOS, original `src` components, types and App callbacks.
Verification: TypeScript and production Expo web export pass; Maven JAR builds.
The disposable-PostgreSQL integration test passed onboarding, tenant isolation, idempotent investments, self-review restrictions, posting immutability, exact account balances, overdraft rollback, booking/inventory transitions and atomic bulk rollback.
Browser verification accepted the demo company and reached its role-free login, but a workspace restart interrupted sign-in and stopped both workflows. Signed-in UI/file-transfer verification therefore remains unconfirmed; no AWS data was touched.

## Ported (bespoke, in `screens/ErpBespoke.tsx`, `screens/ErpStatement.tsx`, `lib/sourceCalc.ts`)
| Surface | Fields / actions |
|---|---|
| Layout master grid (plots) | Facing and status filters with counts, search over number/buyer/facing/block, layout view grouped by facing and a table view. Columns: Plot No, Block, Facing, Dimensions, Road (ft), Area, Rate/Sq.Yd, Total Value, Status, Buyer. Add, edit, delete and review use the server field definitions. "Book plot" launches the wizard. |
| Layout calculator | Typed inputs: totalExtentValue, unit (Acres / Sq. Yards / Guntas-Cents), roadWidth (20/30/40/60), openSpacePercent, floorRatePerSqYard, expectedRatePerSqYard. Uses source road-loss percentages. Saved with erp.settings (`layoutCalculation`), accountant only. |
| Apartment pricing | Typed fields baseSqFtRate, floorRisePerFloor, eastPremium, northPremium, cornerPremium, carParkingFee, amenitiesFee, floorRatePerSqFt. Saved to `pricingMatrix`. Units are grouped by floor, with a per-unit price breakdown and booking launch. |
| Equity | Fixed/proportional split mode (`equitySplitMode`), a fixed-total check, partner profiles (CRUD) and a local what-if calculator (profit pool plus extra investment). The what-if is illustrative and not saved. |
| Firm accounts bar | Account cards with server balances and a type filter. Account detail is a ledger with the statement filters over the records referencing that account. |
| Booking wizard | Four steps: inventory, buyer, payment, confirm. Saves a `bookings` record with inventoryId, buyerName, buyerPhone, advanceReceived, accountId, paymentMode, paymentRefNumber and notes. |
| Investments / expenses / drawings | Filtered list, search, approval detail (approve/reject/edit/delete) and consensus counts. Partner labels come from the en/te dictionary. |
| Project statement | Rows from transactions, investments, expenses, bookings, drawings, settlements and stock-draws. Filters: flow, category, account, mode, status, date (all/month/last30/custom), search, sort. CSV export, print (web) and a detail view. |
| Tally | Modal over approved filtered rows, with XML (all attributes and text escaped) and CSV. Download is web only. |
| Partner dictionary | The full en/te block (218 keys) is in `lib/i18nFull.ts`. Emojis are stripped on render. |
| Attachments | `lib/attachments.ts`. Web file picker and MediaRecorder, with a 10 MB limit and MIME checks. Multipart POST to `/api/erp/{project}/attachments`. Download uses a protected blob GET. The image or audio is shown inline, otherwise a download button. |
| Documents | Fields title, category, attachmentId, with an upload and viewer. |
| Settings | Ledger mode, equity, layout and pricing, all typed. There is no JSON editor. |

## Round 3 additions
| Surface | Detail |
|---|---|
| Partner dashboard | Source KPI cards with progress bars (actual vs estimated investment, drawings vs invested, equity, allotted land area, equivalent plots, expected profit and ROI), a project overview from `details.*`, and quick-action tiles (enroll investment, investment history with pending badge, enroll expense, request draw, view plots, passbook). Tiles use a nav store; create tiles open the form. |
| Liquor (`screens/ErpLiquor.tsx`) | Daily Counter Settlement and Partner Barter / Stock Log tabs, four source KPIs, collection reconciliation bar, per-counter and per-partner totals. sold = opening + received - closing; gross = sold x price; variance = gross - cash - UPI, signed (shortage and excess). |
| Construction | Six source milestones (20/20/15/15/15/15), per-card progress, project summary, payment schedule per unit total. |
| Inventory lifecycle (`screens/ErpInventory.tsx`) | Accountant controls call `erp.inventory-stage` (reserved to sold, booked to registered, milestone update, optional officialDocValue). Needs an approved booking (UI pre-checks). Partner is read-only. |
| Receipts | Booking detail shows approved receipt history and records a ledger credit (category plot_booking_advance or flat_booking_advance, account, booking link). |
| WhatsApp | Explicit-click only: plot availability share and booking receipt summary via wa.me / api.whatsapp.com. No background sending. |
| Audit | Search, actor, action and date (today/7/30/custom) filters; actors shown by partner name. |
| Plan builders (`screens/ErpPlan.tsx`) | Open plotting, construction, custom infra and liquor builders. Saved to `settings.projectPlan`. Plots and units generate through `erp.bulk-save`, split into chunks of at most 2000 rows and 2 MB, each with its own requestId. Duplicate numbers and over-area plans are blocked; chunk failures are reported with the saved count. |
| Review | Pending list with partner names on the dashboard; own records cannot be reviewed; buttons follow `res.canReview`. |
| Attachments | Download now uses fetch with bearer and `res.ok` handling. |

## Source flaws intentionally corrected (not missing parity)
Fabricated defaults (liquor 1400/300 figures, Sy. 42/1A, 48,000,000 outlay, Token Advance default); random bank slip numbers; hard-coded authorizedBy and deductedFromPayout; shortage clamped to 0 hiding excess; local-only state; base64 attachments; WhatsApp-style marketing portal URL.

## Backend fields needed
- Commands: erp.bulk-save {kind plots|units, records, requestId}; erp.inventory-stage {recordId, revision, status, paymentMilestone?, currentMilestone?, officialDocValue?}.
- Settings key `projectPlan` (object per mode: plots, units, liquor, infra).
- settlements: date, counterName, openingBottles, receivedBottles, closingBottles, avgBottlePrice, cashCollected, upiCollected, settledBy, bankDepositSlipNo; optional derived bottlesSold, grossSalesValue, counterShortage, status.
- stock-draws: partnerId, date, stockDetails, bottlesCount, retailValuation, purpose, deductedFromPayout, authorizedBy.
- units: currentMilestone (milestoneStage read as fallback), paymentMilestone, officialDocValue. plots: officialDocValue.
- transactions: type, category (plot_booking_advance | flat_booking_advance), amount, accountId, date, bookingId, paymentMode, paymentRefNumber, description. Link key `bookingId` is assumed.
- Project details: extentValue, extentUnit, roadWidth, openSpacePercent, totalEstimatedOutlay, surveyNumbers, lpOrReraNumber; project location.
- Persisted quotation / discount: proposedRatePerSqYard, proposedToken, tokenDeadlineHours, prospectName, prospectPhone, proposalNotes on bookings (source marketing proposal). Not built in the UI.
- A component key `erp-plan`.

## Honest gaps
- Native capture, export and print are out of scope for this web-first task.
- Backend commands and configuration fields were aligned with the migrated UI; attachment transfers have not been browser-verified.
- The marketing plot portal (public share URL and rate proposals) is not ported; it needs a public route and the quotation fields above.
- Full signed-in browser verification was interrupted by workspace restarts; do not treat it as a passing end-to-end run.
