---
name: Configuration field binding scope
description: Avoid merging unrelated project and partner fields that share an API input key.
---

Configuration field bindings are form-domain-local, not globally unique semantic definitions. A project name and a partner name both bind to `name`, but may have different labels and validation.

**Why:** Merging field definitions solely by their input key wrongly makes project and partner forms share the same meaning. Separate domain-specific interfaces must remain independently configurable.

**How to apply:** Share field definitions only within a compatible form capability. Do not inject missing fields or silently repair invalid database configuration; report validation failures instead.
