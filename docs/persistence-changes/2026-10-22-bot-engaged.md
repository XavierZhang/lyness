---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-22-bot-engaged

English | [中文](2026-10-22-bot-engaged.zh.md)

## Summary

Adds the bot/engaged log event, which records the bot a session speaks as and the character it ran with.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-22-bot-engaged
baseline: false
changes:
  - root: "event:bot/engaged"
    previous: null
    after: "1d814f0805d00b9a45432779ad907e42e4be779ed300abbbe36a552356d2776d"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing records remain valid: the event is new, and a session that never engaged a bot carries none. A build that does not know the type refuses the log rather than reading the conversation without the character the model saw, which is the intended reading — the character reaches the model, so a reader that silently dropped it would misreport what was said and under what prompt.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/identity/managed-bots packages/api/session-controller: 912 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
