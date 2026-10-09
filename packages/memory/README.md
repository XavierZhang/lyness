---
description: "The memory group map: durable facts the agent carries between sessions, for users and maintainers navigating the group."
kind: "package-group"
---

# memory/ — Durable agent memory

English | [中文](README.zh.md)

## Summary

The memory group keeps facts across sessions — conventions, preferences, and other lasting detail about a workspace and the people in it — and folds them into every later request as runtime context. Writes are explicit: a person or an agent asks for something to be remembered, and nothing in the group reads a transcript and decides on its own. Memory is small, mutable, and written during work, which is what separates it from the documents a knowledge base indexes. This page maps the group; the package README owns the per-package contract.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`memory/`](memory/README.md) | Durable facts with an explicit write path, a retention bound, and the runtime-context contribution; `./tools` adds the model-facing write, list, and remove tools | `ctx.memory` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Memory subsystem](../../docs/subsystems/memory.md) — scope, governance, and how memory differs from the knowledge base.
- [Memory, recall, and prompt assembly](../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.md) — the decision record, including what this group deliberately does not do.
- [Generated configuration catalog](../../docs/config-catalog.md) — every config field the group's packages accept.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
