---
name: Configuration field binding scope
description: Avoid merging unrelated project and partner fields that share an API input key.
---

Configuration field bindings are form-domain-local, not globally unique semantic definitions. A project name and a partner name both bind to `name`, but may have different labels and validation.

**Why:** Merging field definitions solely by their input key wrongly makes project and partner forms share the same meaning. Separate domain-specific interfaces must remain independently configurable.

**How to apply:** Share field definitions only within a compatible form capability. Do not inject missing fields or silently repair invalid database configuration; report validation failures instead.

Dynamic dropdown master keys are not necessarily the canonical values accepted by a firm's published ERP form.
**Why:** legacy presentation choices and versioned ERP definitions can use different payment codes. Cash routing can hide this mismatch for project-paid expenses while partner-funded expenses still fail validation.
**How to apply:** preserve explicit database-backed bindings between presentation and canonical values; test both project-account and individual funding paths. Do not mutate published resource definitions or treat client-generated approval metadata as editable business inputs.
