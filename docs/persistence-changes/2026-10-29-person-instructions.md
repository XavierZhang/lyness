---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-29-person-instructions

English | [中文](2026-10-29-person-instructions.zh.md)

## Summary

Adds the `person/instructions` session event: whose instructions a session ran under, and that text verbatim.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-29-person-instructions
baseline: false
changes:
  - root: "event:person/instructions"
    previous: null
    after: "04968946798e4e967c48aec7dab6a73f58e8e5a2979bb2b0edd98a84ee327828"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

A new event root, so no existing record changes. A reader that does not know the type ignores it: the event is log-only attribution and reconstruction, carried by no projection a reader must fold, and the prompt it describes is already reconstructable from the logged `system/message`. A writer at this version emits it only for a session whose creator published a principal, so a log without it reads as a session nobody opened rather than as a missing record.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/identity/personal-instructions packages/api/personal-instructions-controller: 32 tests passed. pnpm run doc-sync: 44 gates passed.

<a id="dev-note"></a>
## Dev Note

None.
