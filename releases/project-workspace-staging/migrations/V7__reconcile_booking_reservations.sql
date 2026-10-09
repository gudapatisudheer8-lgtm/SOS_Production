-- Reservation state follows the authoritative booking lifecycle, not monetary postings.
-- This changes no business record, balance, receipt or approval.
UPDATE sos.erp_inventory_reservations r
SET state=CASE WHEN b.status='approved' THEN 'cleared' ELSE 'released' END
FROM sos.erp_records b
WHERE b.id=r.booking_id AND r.state='active' AND b.status<>'pending';

-- Reserve historical pending bookings as well as bookings created by the new UI.
-- Conflicting historical pending bookings deliberately fail the unique active-
-- inventory constraint; an operator must reconcile them, never silently discard one.
INSERT INTO sos.erp_inventory_reservations(project_id,inventory_id,booking_id,state)
SELECT project_id,inventory_id,id,'active'
FROM sos.erp_records
WHERE kind='bookings' AND status='pending' AND inventory_id IS NOT NULL
ON CONFLICT(booking_id) DO UPDATE
SET inventory_id=excluded.inventory_id,state='active';
