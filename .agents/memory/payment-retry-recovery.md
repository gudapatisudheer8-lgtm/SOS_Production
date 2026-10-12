---
name: Payment retry recovery
description: Avoid duplicate financial writes when a successful save is followed by a failed snapshot refresh.
---

A failed refresh does not mean the payment failed. Preserve the original request identity and recognize an already-issued receipt before retrying or allowing another collection.

**Why:** A write can commit before its follow-up read fails. A later snapshot may normalize buyer details and change the submission fingerprint; generating a fresh request then could record the same payment twice.

**How to apply:** Use persistent record identities, distinguish saved writes from failed reads, and recover the saved receipt by request identity. Clear the old amount after confirmed recovery. Do not rely on the outstanding-balance cap alone to prevent duplicates.
