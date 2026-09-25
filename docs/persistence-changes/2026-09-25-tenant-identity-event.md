---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-25-tenant-identity-event

English | [中文](2026-09-25-tenant-identity-event.zh.md)

## Summary

Adds the tenant/identity session event, which records the tenant a session belongs to and the identity text that tenant contributed.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-09-25-tenant-identity-event
baseline: false
changes:
  - root: "event:tenant/identity"
    previous: null
    after: "0b15140ccd5df3d1f62e93067131f0e738b3302ffcb4c6dc87cb10d802238d71"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing records remain valid: they simply carry no tenant/identity event, and every projection folds an absent record to null. The event is log-only attribution and never reaches the model transcript, so replay and the assembled system prompt are unchanged without it. The envelope does not mark the event ignorable, so a build that does not know the type refuses the log by the repository default; the type ships with the tenant packages that compose the event, and no other composition writes it.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/tenant/tenant-session/tests: 9 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
