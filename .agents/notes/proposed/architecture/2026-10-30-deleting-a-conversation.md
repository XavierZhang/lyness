# Agent Note: Deleting a conversation means deleting it

Status: proposed

English | [中文](2026-10-30-deleting-a-conversation.zh.md)

## Problem

The [personal plane](2026-10-28-the-personal-plane.md) lists one entry a person is entitled to and the harness cannot serve: their own data. Export is shipped — `lyn-session-log-export` archives a conversation with its subagent logs and its attachments, filtered through the ownership rule — and deletion does not exist anywhere. `SessionPersistence` offers `create`, `open`, `flush`, `stat` and `list`; no backend removes a stored session, no service removes a conversation, and no surface offers it. A deployment keeps every conversation it has ever stored, and the only way for a person to be rid of one is to ask whoever runs the deployment to delete files.

That gap is not an oversight about one method. A conversation is several stored logs, several derived stores are folded out of them, and the bytes an uploaded file contributed are addressed by content and shared. "Delete this conversation" therefore needs a decision about what it removes, in what order, and what survives — and whatever is decided is irreversible on released data, which is why it is recorded here rather than inferred from an implementation.

## Proposal

**Deletion is deletion.** `SessionPersistence.delete(id)` removes one stored session permanently, with every format generation of its log. There is no tombstone, no recycle bin, and no recovery; an id is a slot a later session may take. This follows the [schedule domain's](../../implemented/architecture/2026-09-22-schedule-hard-delete-and-bounded-history.md) recorded answer for the same question, where a retained row nothing read cost every reader a state to skip.

**The repository's released-data rule is about migration, not about a person.** [Adjacent migration](../../implemented/architecture/2026-08-31-released-session-format-migrations.md) never moves, overwrites or deletes a committed generation, because a reader that was promised a generation must keep finding it. That promise is made to readers of a conversation that exists. It says nothing about whether a conversation goes on existing, and a person asking for theirs to be gone is not a migration.

**What a conversation is, is the lineage answer the export already uses.** `lyn-session-deletion` takes `sessionQuery.traceSession(id)` and removes the target with every descendant, which is exactly the set the ZIP archives. One answer rather than two: a person who exported a conversation and then deleted it holds everything that was taken, and the two surfaces cannot come to mean different things by the same word.

**Members go deepest first.** Lineage is read from each log's own parent field, so removing a parent first would leave its children in the corpus with nothing to find them by. The reverse of the pre-order walk puts every member's descendants before it, and a deletion that fails part way through is retryable as the same conversation. Removal is not atomic across members, and no backend offers a barrier over several logs; the operation says so rather than implying a transaction.

**An open conversation is refused, not closed.** The trace answers whether a member is live and the deletion refuses with that member named. The trace is one observation, so a member that goes live afterwards is caught by the backend's own write exclusion, which makes the backstop the same exclusion a second writer meets. Ending somebody's running conversation in order to delete it would be a second decision, and it is not this one's to make.

**Derived stores are told, not inferred.** The log goes through persistence; the projection cache's record for that session goes through `sessionProjectionCache.forget`, in that order, so a failure between them leaves a cached record whose log is gone — which the cache's lifecycle identity already refuses — rather than a log whose attribution has been dropped. The search index is not told at all: it rebuilds from the backend's own listing, so a session that leaves the listing leaves the index at the next sync.

**Uploaded bytes stay, and the surface says so.** A file object lives at a content-addressed path and one object serves every conversation that attached the same bytes. With no reference count, removing it would take a file out of a conversation nobody asked about, and keeping it quiet would let a person believe their upload went. So the bytes stay and the page states it, beside the sentence that the deletion is permanent.

**One conversation per call, bounded by what the caller may see.** `sessionData.delete` decides visibility from the conversation's own log — the authoritative read the export route uses, not the listing cache — before anything is removed, and answers a conversation that is somebody else's exactly as one that never existed. There is no bulk deletion and no retention policy: a bound on how long a deployment keeps conversations is a deployment's decision with nobody yet to set it, and the personal page would state such a bound rather than offer it.

## Alternatives considered

**Keep a tombstone so a deletion can be undone.** A recycle bin promises a window nobody has chosen the width of, and the row it retains is the thing the person asked to be rid of. The schedule domain removed exactly such a row for the same reason, and that decision stands.

**Hide the conversation from its owner's list and keep the log.** This is the cheapest implementation and the one the repo forbids: the control would say "delete" while the next call keeps the data, which is the shape of refusal the personal plane exists to remove. It would also leave the owner's attribution in the projection cache, so the deployment would still hold a record of whose conversation it was.

**Delete through the export's own route, so one endpoint archives and removes.** It reads well and fails badly: a browser download that half-succeeded would have removed the log it was still streaming. Export is a read and deletion is a write; they share a lineage answer, not a request.

**Count references to attachment objects so the last conversation out takes the bytes.** This is the only way to make "delete" cover uploads, and it is a change to the attachment store's format rather than to this operation. It is worth doing when a deployment asks; until then the page naming the limit is honest and the refcount is not.

**Add the retention bound now, since the storage layout invites one.** The schedule domain bounded its history because its storage layout required it — one document rewritten per write. A session log has no such pressure, so a bound here would be a retention preference, and a preference about somebody's conversations needs an owner. A deployment that wants one gets a composition row, not a setting inside the personal plane.

## Acceptance criteria

- A person deletes one of their own conversations from the personal plane, and the conversation's log, its subagent logs and their cached projections are gone from storage.
- The search index stops answering for a deleted conversation without being told.
- A conversation belonging to somebody else is answered exactly as one that never existed, and nothing is removed.
- An open conversation is refused with a reason that names what to do, and nothing is removed.
- The set a deletion removes equals the set the ZIP export archives for the same conversation.
- The surface that offers the deletion states that it is permanent and that an uploaded file's bytes stay.

## Risks

**This is the first operation in the harness that destroys released session data.** Every guarantee around it is narrow on purpose: one named session per backend call, one conversation per service call, no atomicity claimed across members, and a refusal wherever a writer is present. The risk that remains is a caller that means something broader than one conversation — a retention sweep, an account closure — reaching for this service and getting a partial result it reads as complete. The result names what was removed for exactly that reason, and a sweep is a consumer to be designed, not a parameter to be added.

**A legacy fork rides with its source.** A modern fork is an independent conversation and carries no parent, but a historical log may record its source in `parentSession`, and such a child is removed with the conversation it hangs from. This is the same set the export archives, so the two stay consistent; a deployment with pre-release logs should know that deleting an old conversation can take a fork of it.

**The refusal depends on a liveness answer that can age.** Between the trace and the removal a conversation can be opened. The backend's write exclusion is what actually protects the log, and the service's own refusal is the legible one; a backend that ever implemented `delete` without taking write ownership would turn this risk into data loss, which is why the Service Definition states the exclusion as part of the operation rather than as advice.
