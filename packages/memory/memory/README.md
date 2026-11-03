---
description: "Durable agent memory with an explicit write path and a prompt contribution, for users keeping facts across sessions and maintainers wiring the service."
kind: "package-reference"
---

# @lyness/lyn-memory

English | [中文](README.zh.md)

## Summary

`lyn-memory` keeps facts across sessions: conventions, preferences, and other lasting detail a person or an agent asked to remember. Mount the service and every later request carries those facts as runtime context; mount `./tools` and the agent can write, list, and remove one when asked. Writes are explicit only — nothing here reads a transcript and decides what is worth keeping. Each entry is at most 2048 characters, retention drops the oldest first, and a store the service cannot validate fails the read instead of reporting an empty memory.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the service entry on the Host plane when the agent should start a session already knowing how this workspace works. It owns one durable store, so it must have exactly one owner: an agent preset cannot mount it, and a preset that tries is refused for want of an isolate realm. Mount only `./tools` inside a preset. It needs `ctx.storageDomain` for durability and `ctx.systemPrompt` for the contribution; a deployment with neither cannot mount it. Mount `@lyness/lyn-memory/tools` as well when the agent should write memories itself; omit it to keep the facts readable while only host code writes them.

```yaml
- id: memory
  name: '@lyness/lyn-memory'
  config:
    maxEntries: 200
    contextOrder: 130
- id: memory-tools
  name: '@lyness/lyn-memory/tools'
```

| Field | Default | Meaning |
|---|---|---|
| `maxEntries` | `200` | Entries retained before a write drops the oldest |
| `contextOrder` | `130` | Runtime-context sort position, after the policy entries |
| `promptEntries` | `12` | Newest entries the prompt carries; the rest stay reachable through the tools |

### The service API

| Member | Contract |
|---|---|
| `remember(text, scope?, supersedes?)` | Store one fact. Trims the text; rejects a blank one and one longer than `MAX_ENTRY_CHARS`. `scope` is `member` (default) or `shared`; a `member` write belongs to the person whose conversation asked for it, and a conversation with no owner writes the shared table. `supersedes` removes the entry it names in the same durable write, so a changed convention leaves one answer rather than two; an id already gone is not an error. Returns the stored record with its new id. |
| `list()` | Every record the current conversation may see, oldest first: the deployment's shared entries plus its own person's. |
| `forget(id)` | Remove one record the current conversation may see; `true` when one was removed, `false` when it may see none with that id. |
| `listOwnedBy(owner)` | One person's own records, oldest first. The personal page's read; shared entries are not theirs to review there. |
| `forgetOwnedBy(owner, id)` | Remove one of that owner's own records; an id belonging to anybody else removes nothing. |

Durable mutations run one at a time, so two concurrent writes cannot interleave their retention passes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The service opens the `memory` storage domain once and keeps a snapshot of its entries for the prompt provider; the domain stays the authority, and every write refreshes the snapshot from it. The prompt contribution is a `ctx.systemPrompt.context()` entry whose text is evaluated at each assembly, so a write lands in the next request without rebuilding anything ahead of it in the prompt.

Entries reach the model inside the assembled system prompt, which the session log already records as a `system/message`. That is why this package adds no session event of its own: what the model saw stays reconstructable from the log through the existing surface event.

Retention runs inside the same durable write that added an entry, dropping the oldest first, so the newest fact always survives its own write.

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The service, its resolved configuration, and the prompt contribution |
| [`src/tools.ts`](src/tools.ts) | The `memory_write` / `memory_list` / `memory_forget` tools and their shared presentation fold |
| [`src/storage.ts`](src/storage.ts) | The durable domain and the stored-entry schema |
| [`src/types.ts`](src/types.ts) | The entry, its scope, and the branded identity |

**Runtime invariant:** No companion is published. The stored entries are one owned table validated at the durable boundary by its schema, and the prompt snapshot is refreshed from that table on every write, so no two independent observations of memory can diverge.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-storage-domain`](../../storage/storage-domain/README.md) — the durable domain this service opens.
- [`lyn-system-prompt`](../../core/system-prompt/README.md) — runtime-context ordering and assembly.
- [Memory subsystem](../../../docs/subsystems/memory.md) — scope, governance, and how memory differs from the knowledge base.

-----

<a id="model-experience"></a>
## Model Experience

### Remembered facts in the request

#### What the model sees

An empty store contributes no text at all. With entries, the runtime context carries one bounded block: the newest `promptEntries`, newest first, and a statement of how many older facts it withheld. Carrying every retained entry in every request is what makes a memory store a token cost with no ceiling, so the block is bounded and says where the rest are — without that statement a withheld fact reads as a fact nobody wrote.

##### The remembered-facts block

```markdown
Remembered about this workspace and the people in it:
- <fact>
- <fact>
```

##### The tool results

```markdown
Remembered as <id>.
<id>	<fact>
Nothing is remembered yet.
Forgot <id>.
No remembered fact carries the id <id>.
```

#### Token effect

The block costs one line per shown entry on every request, bounded by `promptEntries` rather than by how much is stored, plus one line when it withheld anything. `memory_list` returns everything with ids, which is how the agent reaches a withheld fact or obtains an id to supersede.

#### KV Cache effect

The block sits in the system prompt, so a write changes the reusable request prefix and invalidates cached entries from that point. An unchanged store reproduces byte-identical text, and a store that has never been written contributes nothing and leaves the prefix untouched.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this package is a poor fit or needs special care. They are current package constraints, not a task backlog.

- **Entries written before owners were recorded stay shared** — they are in the shared table, so every reader keeps seeing them, which is what they have always been. They belong to nobody's page, and only an agent's `memory_forget` reaches them.
- **A shared entry is removable from any conversation** — `memory_forget` takes any entry its caller can see, and that includes the deployment's shared ones. A deployment that needs those protected needs a permission preset, not a scope.
- **An organization still has no review surface** — a person reviews their own; nothing lists the deployment's shared entries for an administrator.
- **Retention is a count, not a relevance judgement** — the oldest entry is dropped even when it is the most useful one.
- **Written facts are never re-validated** — a convention that stops being true stays in every request until someone removes it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
