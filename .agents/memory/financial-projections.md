---
name: Financial projection integrity
description: Shared posted-ledger projections, approval timing, and non-locking dashboard snapshots.
---
Use one server-produced project financial statement for all roles and clients. Account movements come from posted journal entries; partner aggregates must not add the same account history again.
**Why:** reconstructing statements from expenses, plot advances, investments and transaction lists introduced duplicate counting and missed drawings.
**How to apply:** preserve event IDs, actual receiving/paying accounts, and pending/non-cash distinctions. Changes to financial views must cover both accountant and partner paths. Historical balances should follow clearing order, not submission order.

Read-only repeatable-read dashboard snapshots must use non-locking access checks; retain project row locks for financial writes.
**Why:** PostgreSQL rejects FOR UPDATE inside a read-only transaction. Tests wrapped in an outer writable transaction can conceal this failure.
**How to apply:** include a dashboard-read regression outside an enclosing writable test transaction whenever changing financial snapshot isolation or authorization queries.
