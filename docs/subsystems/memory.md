# Memory

English | [中文](memory.zh.md)

Durable facts the agent carries between sessions, written only by an explicit act and folded into every later request as runtime context. The [memory contract](../../packages/memory/memory) owns the stored entry, its retention bound, the branded identity, and the prompt contribution; the decision record is [memory, recall, and prompt assembly](../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.md).

Sources: [`packages/memory/memory/src/types.ts`](../../packages/memory/memory/src/types.ts) · [`packages/memory/memory/src/storage.ts`](../../packages/memory/memory/src/storage.ts)

## What a memory is

One remembered fact: a text, a scope, and the instant it was written. A fact is a convention, a preference, or a lasting detail about a workspace and the people in it — not task state, not a secret, and not a document. The entry bound (2048 characters) exists to keep that distinction enforceable rather than advisory.

Identity is opaque and branded. The model sees an id only so it can ask for one fact to be removed.

## Writes are explicit

`remember()` is the only write path. Nothing observes a transcript and decides what is worth keeping, because a memory the customer never approved is one they cannot audit, and it would make every conversation a silent input to later ones. An agent writes a memory when a person asks it to; host code writes one when a product surface asks.

## Scope

`member` is the default: the fact belongs to whoever wrote it. `shared` is a fact published to everyone in an organization.

Today nothing resolves a person, so a deployment holds one store and the field records intent rather than enforcing separation. Membership scoping arrives with the [acting context](../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) and reads the same field without changing the stored format.

## How a memory reaches the model

As runtime context in the assembled system prompt, evaluated at each assembly so a write lands in the next request. An empty store contributes nothing, which keeps the request prefix byte-identical for a deployment that has never written one.

The session log already records the assembled prompt as a `system/message`, so what the model saw stays reconstructable without a memory-specific session event. That is the whole reason this subsystem adds no event type: [model-visible content flows through the surface event types](../../.agents/notes/implemented/architecture/2026-08-10-session-log-version-mechanism.md), and the system prompt is one of them.

## Memory is not the knowledge base

| | Memory | Knowledge base |
|---|---|---|
| Authored | During work, a fact at a time | Elsewhere, as documents |
| Reviewed | No | Yes |
| Versioned | No | Yes |
| Size | Bounded per entry | Whole documents |
| Reaches the model | In every request | When retrieved |

They have different write paths and different lifetimes, and no path writes one through the other. A merged surface would have to carry both policies and would default to the weaker one.

## Governance

An organization can list and delete everything held for its members — the condition for holding the data at all, not a later refinement. A store the service cannot validate fails the read rather than reporting an empty memory, because a silent empty read is indistinguishable from a customer's facts having been dropped.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmemory--memoryservice"></a>

### `ctx.memory` — `MemoryService`

Durable memory with an explicit write path and a prompt contribution.

```ts cordis-catalog
/**
 * Keep one fact. The only write path: there is no listener that stores
 * anything a caller did not ask for.
 * @param text - the fact to keep, trimmed and non-empty.
 * @param scope - reach of the entry; defaults to the writing member.
 * @returns the stored record, including its new identity.
 * @throws {TypeError} when the text is blank or longer than {@link MAX_ENTRY_CHARS}.
 */
async remember(text: string, scope: MemoryScope = 'member'): Promise<MemoryRecord>

/**
 * Read every kept fact, oldest first.
 * @returns the stored records in write order.
 */
async list(): Promise<readonly MemoryRecord[]>

/**
 * Remove one kept fact.
 * @param id - the record's identity.
 * @returns true when an entry was removed, false when none carried that id.
 */
async forget(id: MemoryId): Promise<boolean>
```

Source: [`packages/memory/memory/src/index.ts`](../../packages/memory/memory/src/index.ts)
<!-- END GENERATED cordis-surface -->
