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
 *
 * `supersedes` is how a remembered fact is corrected rather than
 * contradicted. A store that can only append ends up holding both halves of
 * a changed convention, and nothing in the text says which one is current;
 * replacing the superseded entry in the same durable write leaves exactly
 * one answer. An id that no longer exists is not an error — the fact it
 * named is already gone, which is the outcome the caller wanted.
 * @param text - the fact to keep, trimmed and non-empty.
 * @param scope - reach of the entry; defaults to the writing member.
 * @param supersedes - an entry this one replaces, removed in the same write.
 * @returns the stored record, including its new identity.
 * @throws {TypeError} when the text is blank or longer than {@link MAX_ENTRY_CHARS}.
 */
async remember(text: string, scope: MemoryScope = 'member', supersedes?: MemoryId): Promise<MemoryRecord>

/**
 * Read every fact this reader may see, oldest first.
 *
 * What the current conversation's agent may see, which is the deployment's
 * shared entries plus its own person's. The model-facing `memory_list` is
 * the caller this matters for: it must report exactly the facts the prompt
 * already carries, or an agent would be told about a fact it cannot act on.
 * @returns the visible records in write order.
 */
async list(): Promise<readonly MemoryRecord[]>

/**
 * Read one person's own facts, oldest first.
 *
 * Separate from {@link list} because the caller is different: a person
 * reading their own page is not inside a conversation, and the shared
 * entries are not theirs to review here.
 * @param owner - whose entries to read.
 * @returns that owner's records in write order.
 */
async listOwnedBy(owner: MemoryOwnerId): Promise<readonly MemoryRecord[]>

/**
 * Remove one of a person's own facts.
 *
 * The owner is a parameter here and the id is checked against it, so a
 * caller holding somebody else's id removes nothing.
 * @param owner - whose entry is being removed.
 * @param id - the entry's identity.
 * @returns true when that owner held an entry with that id.
 */
async forgetOwnedBy(owner: MemoryOwnerId, id: MemoryId): Promise<boolean>

/**
 * Remove one kept fact.
 * @param id - the record's identity.
 * @returns true when an entry was removed, false when none carried that id.
 */
async forget(id: MemoryId): Promise<boolean>
```

Source: [`packages/memory/memory/src/index.ts`](../../packages/memory/memory/src/index.ts)

<a id="ctxmemorycontroller--memorycontroller"></a>

### `ctx.memoryController` — `MemoryController`

Host service backing the generated `ctx.remote.memories` namespace.

```ts cordis-catalog
/**
 * Read what is remembered about this caller.
 * @returns their own entries, oldest first.
 */
@Remote async list(): Promise<MemoriesView>

/**
 * Remove one of this caller's own memories.
 * @param id - the entry's identity, as a read reported it.
 * @returns what remains after the removal.
 * @throws {Error} when the call speaks for nobody.
 */
@Remote async forget(id: string): Promise<MemoriesView>
```

Source: [`packages/api/memory-controller/src/index.ts`](../../packages/api/memory-controller/src/index.ts)
<!-- END GENERATED cordis-surface -->
