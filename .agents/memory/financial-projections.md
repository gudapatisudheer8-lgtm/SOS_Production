---
name: Financial projection integrity
description: Shared posted-ledger projections, receipt integrity, and non-locking dashboard snapshots.
---
Use one server-produced project financial statement for all roles and clients. Account movements come from posted journal entries; partner aggregates must not add the same account history again.
**Why:** reconstructing statements from expenses, plot advances, investments and transaction lists introduced duplicate counting and missed drawings.
**How to apply:** preserve event IDs, actual receiving/paying accounts, and pending/non-cash distinctions. Changes to financial views must cover both accountant and partner paths. Historical balances should follow clearing order, not submission order.

Plot reservation alone is not proof of a posted cash credit. Keep the saved receipt amount and destination visible and distinguish an actual receipt from a booking commitment.
**Why:** booking status and cash receipts previously became confused, making the cash ledger appear broken.
**How to apply:** preserve receipt-to-ledger traceability in both dashboards when removing approvals under the user's simplification request. Do not add promised or unreceived amounts to spendable account balances.

Read-only repeatable-read dashboard snapshots must use non-locking access checks; retain project row locks for financial writes.
**Why:** PostgreSQL rejects FOR UPDATE inside a read-only transaction. Tests wrapped in an outer writable transaction can conceal this failure.
**How to apply:** include a dashboard-read regression outside an enclosing writable test transaction whenever changing financial snapshot isolation or authorization queries.

Compare numeric ERP-record values using decimal-safe numerical equality; verify display formatting separately.
**Why:** JSON validation and reload can produce different insignificant trailing zeroes for the same value, creating false save-regression failures despite unchanged quantities and balances.
**How to apply:** Do not interpret a change in numeric spelling as a cash movement or lost update. Retain independent checks for allowed precision, rounding and formatted balance contracts.
