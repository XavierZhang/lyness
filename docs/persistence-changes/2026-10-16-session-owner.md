---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-16-session-owner

English | [中文](2026-10-16-session-owner.zh.md)

## Summary

Adds `session/owner`, the one-time record of who opened a session and the standing they held it open under.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-16-session-owner
baseline: false
changes:
  - root: "event:session/owner"
    previous: null
    after: "6d5b72b6153d90f7cb549610592cd49e034a721f50f99b5b5e3ae89460fb6279"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Backward compatible for readers that know the event: existing logs carry none and read as unowned, and the record is written once at creation so no log is rewritten. A build that does not know the type refuses the log rather than serving a conversation without its attribution, which is the intended protection on a hosted deployment. Sessions opened outside a request principal — a CLI run, a subagent, an inbound webhook — carry no record, and absence means unowned rather than unknown.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/identity/session-ownership: 8 tests passed, including a real-Loader composition proving a session created inside a signed-in call is attributed and one created outside is not.

<a id="dev-note"></a>
## Dev Note

None.
