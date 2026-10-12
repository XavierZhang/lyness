# Agent Note: Memory the agent derived, and the evidence that lets it be undone

Status: proposed

English | [中文](2026-10-12-derived-memory-and-its-audit.zh.md)

## Problem

[The memory decision](2026-10-09-memory-recall-and-prompt-assembly.md) rejected deriving memories from a transcript, on the ground that it "writes facts the customer never approved and cannot audit". The first half of that is a trade customers may want to make; the second half was the actual objection, and it is a property of the implementation rather than of the idea.

The cost of refusing is real. Explicit writing means a fact is kept only when somebody thinks to ask, so the conventions an organization actually runs on — the ones nobody states because everybody knows them — are exactly the ones that never get written. Mem0's extraction-and-update loop exists because that gap is the common case, not the edge case.

The cost of allowing it, as rejected, is also real. A store that writes by itself holds facts whose origin nobody can reconstruct: a wrong one cannot be traced to what produced it, a customer cannot tell which of their memories they authorized, and removing a bad one destroys the only evidence that it was ever acted on.

So the question is not whether to derive. It is whether a derived memory can carry enough of its own history to be reviewed and reversed.

## Proposal

Derivation is allowed, and every derived memory records the session and turn it came from, is logged there, and can be invalidated without erasing the record.

### The originating session and turn are a field, not a convention

Every entry records how it came to exist: a person asked, or the agent derived it. A derived entry additionally records the session and turn it was derived from.

Without that field there is no audit, only a list. With it, "where did this come from" has an answer that does not depend on remembering, and the two classes can be treated differently everywhere else in this note.

### A derivation is logged in the session that produced it

The write is recorded as an event in the **originating session's** log, not only in the memory store. That is where a reviewer looks: the turn is right there, and the claim derived from it sits beside it.

This gives the audit two ends that meet. From a memory, its recorded origin names a session and turn. From a session, its log names the memories that turn produced. Either direction answers the question, which is what makes a wrong derivation findable rather than merely recorded.

### Invalidation is not deletion

A derived memory that turns out to be wrong is **invalidated**: it stops reaching requests, and the record stays with the reason and the moment. Deleting it would destroy the evidence that it had been in every request for a week, which is the thing a customer reviewing a bad answer needs most.

Explicit deletion stays available for the separate case — a memory that should never have been stored at all, not one that was stored and proved wrong.

### The derived class never outranks the explicit one

The prompt carries a bounded set of the newest entries. Derived entries are far more numerous than explicit ones, so recency alone would push a person's stated conventions out of the block with inferences about them.

Explicit entries therefore take the budget first, and derived ones fill what remains. An organization that wants only what it stated can set the derived share to zero without turning derivation off, which keeps the audit trail accumulating while nothing derived reaches a model.

### Mem0's four operations map onto what already exists

Extraction proposes operations; three of them already have a home. `ADD` is a new derived entry. `UPDATE` is the `supersedes` write, which replaces in one durable operation instead of leaving both halves of a changed convention. `DELETE` is invalidation. `NOOP` writes nothing and is the common outcome.

The loop adds no fifth verb, which is the point: derivation changes who writes, not what a write means.

### What derivation costs is stated, not hidden

Extraction is a model request per turn it examines, so it is configuration — which turns it examines, and whether it runs at all — and not an always-on background behaviour. A deployment that pays nothing for it should be able to have it, and a deployment paying for it should be able to see what it bought in the same audit the invalidation uses.

## Alternatives considered

**Keep refusing derivation.** It is the current decision and the simplest story: every memory was asked for. Rejected: it keeps the gap that makes derivation attractive — the conventions everybody knows and nobody states — and the stated objection was auditability, which a recorded origin answers.

**Derive into a queue a person approves before it is stored.** Nothing unapproved ever reaches a model, which is the strictest reading of the original objection. Rejected as the default: a queue that nobody drains is a feature that does nothing, and the approval work scales with the conversation rather than with the value. It remains the right shape for an organization that wants it, as a policy over the same origin field rather than a second mechanism.

**Store derived memories separately from explicit ones.** Two stores make the classes impossible to confuse. Rejected: one store with an origin field answers the same question, and two stores would need two retentions, two prompts, and two audits that have to agree.

**Delete a wrong derived memory instead of invalidating it.** Simpler state, and a customer asking for removal usually means removal. Rejected: the record is the evidence that the memory was in every request until it was caught, which is exactly what a customer reviewing a bad answer is looking for.

**Let recency alone decide the prompt budget.** It is what the bounded block already does and needs no new rule. Rejected: derived entries outnumber explicit ones, so the block would fill with inferences and drop the conventions a person actually stated.

## Acceptance criteria

- Every entry records whether a person asked for it or the agent derived it, and a derived entry records the session and turn it came from.
- A derivation appends an event to the originating session's log, so the turn and the claim derived from it can be read together.
- An invalidated entry reaches no model request and remains readable, with its reason and the moment it was invalidated.
- Explicit entries take the prompt budget before derived ones, and a deployment can set the derived share to zero while derivation keeps running.
- Extraction runs only where configuration says it does, and what it cost is readable in the same place as what it wrote.
- A derived entry that supersedes another replaces it in one durable write, and invalidation and deletion remain distinct operations.

## Risks

**A recorded origin can be wrong without being detectably wrong.** The session and turn a derivation names are what the extractor believed it read. If extraction summarizes across turns, the recorded origin is the best available answer rather than a proof, and an audit that treats it as a proof will mislead.

**The audit trail is the sensitive data too.** A recorded origin ties a claim about a person to the exact conversation that produced it. The invalidated record keeps that tie after the claim stops being used, so a store that holds many invalidated derivations holds a long history of inferences about named people.

**Derivation is a recurring model cost tied to conversation volume, not value.** It scales with how much people talk, and most turns produce `NOOP`. A deployment can tune which turns it examines, but the shape is that the busiest customers pay the most for the least new information.

**Invalidation needs somebody to notice.** Nothing here detects a wrong derived memory; it makes one reversible once found. The failure mode is a plausible wrong fact nobody questions, which keeps reaching requests precisely because it reads as reasonable.
