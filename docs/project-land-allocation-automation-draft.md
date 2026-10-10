# Project land allocation automation — deferred enhancement draft

## Timing and scope

Requested for design and implementation **after EC2 deployment**.
This draft does not authorize application changes, database migrations or
deployment changes now. Resume this enhancement when the user asks to proceed.

Goal: a simple, synchronized view of how the project's declared venture area
is allocated, with automatic calculations and a clear unallocated balance.

## Shared calculation

- Declared venture area is the total land limit for the project.
- Convert entered units to one canonical calculation unit using database-managed
  conversion definitions; display square yards and the original venture unit.
- Allocated area = unique plot area + road area + utilities/open-space area.
- Unallocated area = declared venture area minus allocated area.
- Count each physical area once. Facing, commercial and corner classifications
  must not duplicate a plot's land usage.
- Booking or selling a plot changes its sales status, not its allocated land area.
- Unallocated land is not automatically an approved, saleable plot.

Illustrative calculation only, not application seed data:

| Item | Square yards |
| --- | ---: |
| Venture: 15 acres | 72,600 |
| Plots | 42,000 |
| Roads | 16,000 |
| Utilities and open spaces | 6,000 |
| Allocated total | 64,000 |
| Unallocated balance | 8,600 |

## Recommended first phase

### Live area summary

Show venture area, plot area, road area, utilities/open-space area, total
allocated area and unallocated balance beside the physical-plan section.
Recalculate immediately on changes to venture extent, units, plot count/size,
road inputs or utility areas. Show each category subtotal.

### Simple road entry

Offer two input methods:

1. Enter measured total road area from the layout.
2. Enter road sections with width and length, calculating each section's area.

Width in feet × length in feet ÷ 9 gives square yards for a rectangular section.
Width alone cannot establish occupied road area. Account for overlapping
intersections once and ensure roads remain within the venture boundary.
Agree on a simple intersection-adjustment method during design; do not claim
exact automatic geometry without layout measurements.

Any percentage-based estimate must be clearly labelled estimated and remain
distinct from measured road area. Do not silently treat an estimate as an
approved layout measurement.

### Allocation limits

Validate the combined allocation against declared venture area in both frontend
and backend. Clearly display any excess and the category subtotals.

Recommended draft behavior: retain incomplete/over-allocated inputs with an
explicit warning, but prevent creation/finalization of an over-allocated layout.
Do not silently shrink or alter user-entered plots, roads or utilities.
Use consistent decimal precision and a reviewed rounding policy; never disguise
over-allocation by truncating values.

## Recommended second phase

- Preserve the compact facing-wise plot matrix.
- Support additional plot-size groups under each facing.
- Allow individual plot adjustments without counting both the planned group and
  its generated inventory as separate land allocations.
- Decide safeguards for editing venture area or geometry once plots are booked,
  sold or linked to cleared transactions. Preserve financial and booking history.

## Synchronization and storage

- All allocations belong to the project; firms only link their projects.
- Use the same project-owned saved allocation and calculation rules in setup,
  Open Plotting, accountant dashboards and authorized partner dashboards.
- Define the authoritative source before implementation: planned groups before
  inventory generation, and actual unique plots after generation/reconciliation.
- Persist entered measurements and their measured/estimated basis in PostgreSQL.
- Keep unit conversions, configurable limits, authority-specific requirements
  and any estimation percentages in database configuration.
- No mock operational records, invented land measurements or universal
  hardcoded statutory open-space percentage.
- Keep published sector definitions and existing firm assignments intact.

## Acceptance checks for later implementation

1. A 15-acre venture displays 72,600 square yards using its configured conversion.
2. Every allocation edit updates its subtotal and the unallocated balance.
3. Counts, mixed-size groups and generated plots reconcile without duplication.
4. Roads, intersections and utilities are counted once.
5. Over-allocation produces a clear warning and is rejected on finalization by
   the backend as well as the UI.
6. Inputs and measurements survive saving, reloading and permitted cross-session
   viewing; dashboard totals match project setup.
7. Plot sales do not reduce allocated land or increase unallocated land.
8. Changing venture extent or units cannot silently invalidate existing layout
   data or modify booked plots and cleared transactions.
9. No data from another project appears in its allocation totals.

## Recommendation

Implement the first phase together: live summary, measured/section-based road
entry and allocation enforcement. Add mixed-size groups and individual editing
after that behavior is stable. Keep the initial interface compact.
