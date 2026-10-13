# Native mobile parity assessment

## Required outcome

Keep the existing web application and native mobile application. Native accountant and partner dashboards must reproduce the **current web** features, branding, terminology, visible values, role permissions and connected workflows. Adapt spacing and touch interaction to phones without deleting features.

This is a port into React Native, not an embedded website. Browser rendering of Expo is a preview only; final native acceptance requires a device. Owner access remains web-only.

## Confirmed current mismatch

The mobile application uses separate older screens and calculations. Its connection now works, but that does not establish parity:

- The accountant dashboard renders an accounts bar and a generic ERP dashboard rather than the current web four-card dashboard.
- The older partner dashboard retains separate investment/history and expense/drawing shortcuts that the current web interface removed.
- Older tab names and approval terminology remain visible.
- The booking wizard still describes receipts as pending and derives a displayed outstanding amount from the current advance, rather than the server's cumulative booking-payment summary.
- The native screens do not consume the current registration appointment and receipt workflow.
- Attachment handling currently explicitly supports the browser rather than native device file selection.

Existing correction commands and server-side financial enforcement are present. They must be reused, not replaced with a new ledger or mistaken for complete UI parity.

## Parity inventory

| Area | Required native behavior |
| --- | --- |
| Shared header | Current SOS branding; firm before project selector; correct firm identity; compact role label; profile-menu account actions; notification bell; compact En/Te for partners. |
| Navigation | Accountant: Dashboard, Partners & Equity, Open Plotting and Project Statement for open plotting. Partner: Dashboard, Plots and Project Statements. Preserve current sector-specific modules where applicable; do not restore removed approval tabs. |
| Accountant dashboard | Current project-cost card with partner names/shares, projected sales card, inventory card and bank-plus-cash project-account card. Match posted-money breakdown and card navigation. |
| Partner dashboard | Net share balance with investment target, actual invested, drawings and expected profit; inventory and bank-plus-cash cards; current land allocation and venture summary. |
| Project setup | Comprehensive Add/Edit Project sections, firm/project scoping, empty new-project draft, directional plot matrix, partners, documents, editable bank accounts and default Cash account. Preserve creation/retry safety and existing plot/payment protection. |
| Partners & equity | Current partner list, fixed/capital-weighted basis, investment totals, land/profit allocation, partner enrolment and permission-correct credential recovery. |
| Plot grid | Current plot details and saved layout metadata, correct booking categories/counts, current filters, buyer context, purple active-registration badge and preserved sold precedence. |
| Booking/collections | One existing native plot form with locked buyer/rate/area context, cumulative collected amount, balance and payment history. Cap the next payment against the saved balance and recover receipts after an ambiguous retry. |
| Receipts | Consume saved receipt snapshots; share the same customer/plot/agreed price/payment/cumulative/balance information without inventing totals or exposing removed identity fields. Adapt sharing/printing to native capabilities. |
| Registration | Date, time, location, reminder leads, save/edit/cancel inside the plot collections form. Appointment-only actions create no money or receipts and do not automatically sell/register plots. |
| Project statement | Current posted ledger and balances; search, flow/account/category/enrolled-by filters and sorting; investment/expense/drawing actions in the role-correct location. No approver/status columns or approval gates. |
| Corrections | Refer back with a reason, server-side reversal when appropriate, edit/resubmit in the same statement context, immutable original history and recalculated balances. |
| Notifications | Recipient-scoped bell/read state. Native push uses device registration and appropriate native delivery, not browser VAPID subscriptions. Reuse persisted server scheduling and prevent duplicate jobs. |
| Documents/blueprints | Native file selection, private upload/download, original plan and reviewed geometry workflow, readable plots/roads/facings and reviewed illustrative 3D navigation. No invented dimensions or unreviewed geometry presented as surveyed data. |
| Other sectors | Preserve the current construction, liquor and other configured sector workflows for both roles; do not silently reduce the product to open plotting. |

## Implementation approach

1. Audit the current web modules, inputs, actions and role rules against the native screens; use this inventory as acceptance criteria, not a claim of completion.
2. Reuse the existing API, sessions, project identifiers, posted-ledger projections, booking summaries, stored receipts and correction commands. Do not introduce a second database or independent financial calculations.
3. Share platform-independent calculations and mapping where practical. Keep native views and device interactions separate from browser-only HTML/CSS, printing and file inputs.
4. Replace the old native dashboard shell and role navigation with source-faithful native screens. Carry over each current form and its working backend behavior, not just the dashboard appearance.
5. Verify state after save/reopen/reload, project switching, another authorized session, payment retries and correction/resubmission.
6. Compare both roles side by side with the current web version. Verify phone rendering and real native interaction separately from browser preview.

## Delivery constraints

- Web/EC2 stays unchanged while mobile is rebuilt and reviewed.
- Development preview must be clearly distinguished from production data.
- Native runtime errors must be fixed, not dismissed as styling differences.
- Do not claim complete parity after connection repair, a dashboard reskin or a browser-only check.
- No promotional video work until explicitly requested.

This assessment does **not** mean the native rebuild has been completed.
