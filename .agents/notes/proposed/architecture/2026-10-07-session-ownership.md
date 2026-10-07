# Agent Note: Session ownership through the person who opened it

Status: proposed

English | [中文](2026-10-07-session-ownership.zh.md)

## Problem

A Session is a durable conversation between a person and an agent. Nothing in it records whose conversation it is.

The one record that comes close is the `tenant/identity` event [`lyn-tenant-session`](../../../../packages/tenant/tenant-session/README.md) writes at creation, and it names the tenant this *deployment* was configured with rather than the tenant the creating request resolved to. In a private deployment those are the same thing, so the gap is invisible. In the hosted product one process serves many organizations, and every session it stores would carry the same tenant — the attribution of record would be wrong for every customer but one, and a Session log is durable, so it would be wrong permanently.

There is no identity below the organization at all. [`lyn-tenant-request`](../../../../packages/tenant/tenant-request/README.md) resolves a call to an organization, not to a person in it, and the only user-shaped thing in the tree is [`anonymous-user-id`](../../../../packages/identity/anonymous-user-id/README.md), which exists precisely to correlate telemetry *without* identifying anyone. So the question "who opened this conversation" has no answer to record yet.

Two consequences make this urgent rather than merely incomplete. A Session log is released data: committed generations are never rewritten, so attribution recorded wrongly stays wrong, and attribution added in two steps costs two format changes instead of one. And an organization that cannot say which of its people opened a conversation cannot answer for it — which is the first thing a business customer asks of a platform that runs agents on its behalf.

## Proposal

A Session belongs to the person who opened it. The organization's claim on it is held through that person, and recorded as it stood when the conversation began.

### What a Session records, once

At creation a Session carries one durable ownership event naming two things:

- **the owner** — the user who opened it, always present in the hosted product;
- **the organization that user belonged to at that moment** — present for a member, absent for an individual customer.

The organization is recorded rather than derived from the user's current membership, because people move. A member who leaves Acme and joins Globex must not drag three months of Acme's conversations into Globex's account, and an organization reading its own history must see what was true when each conversation happened. The owner answers "whose is this"; the recorded organization answers "under whose roof was it opened".

The event is written once, at creation, and never rewritten. It is the attribution of record.

### An individual has no organization

A customer who is not part of an organization owns their Sessions directly, and the ownership event names no tenant. The absence is the individual case; nothing stands in for it. This keeps every organization in the system a real one, which is what the plan gates in [per-tenant brand](2026-10-07-per-tenant-brand.md) and everything else priced per organization depend on.

### Removing a member archives, it does not delete

An organization can end a member's standing — removing the person, or reclaiming the seat they held. Neither touches the Session record: the conversations stay, attributed exactly as before.

What changes is the person's state, and a Session whose owner no longer stands in the organization reads as archived. The state is derived from the owner rather than stamped on each Session, so ending a membership is one write rather than a sweep across every conversation that person ever opened, and restoring a reclaimed seat needs no second sweep to undo. Archived means retained and readable by the organization, not hidden from it: an organization that cannot read what it is answerable for has gained nothing from the archive.

### The request must carry the person

None of this is recordable until a call resolves to a person rather than to an organization. That layer — users, their membership in an organization, and what each may do — is the prerequisite, and this note does not design it.

One decision about it is already made and belongs here because the operations above depend on it: when an organization finishes onboarding, a **platform administrator assigns its first tenant administrator**, and only then can the organization configure or manage anything itself, including removing members. An organization cannot bootstrap its own first administrator. The note that designs the user and role layer owns that rule; it is recorded here so the archival and reclamation operations have a defined actor.

### Sequencing

Ownership and the organization land in the Session log together, as one format change, after the user layer exists. Recording the organization now and the person later would change released Session data twice, and the first generation would be a shape nothing ever wanted.

## Alternatives considered

**Keep attribution in `tenant/identity`.** That event already names a tenant, so it could carry the person too. Rejected: it exists to record what an organization contributed to model requests — its constraints and personality, verbatim — which is a different fact with a different lifetime. Attribution gets its own event, and `tenant/identity` keeps only the half it was built for.

**Record the request's organization now, add the person later.** It fixes the acute defect sooner. Rejected: it costs two changes to released Session data, and the intermediate generation records an organization without an owner, which is a shape no consumer wants.

**Give every individual a personal organization.** Uniform: every Session has a tenant, every query has one shape. Rejected: it fills the system with organizations that have one member and no administrator, and makes every per-organization decision — plan gates, branding, billing — answer a question about a fiction.

**Derive the organization from the owner's current membership.** No second field, and membership is already stored. Rejected: it rewrites history whenever a person changes organization, which is the one thing the attribution of record must never do.

**Delete a removed member's Sessions.** Clean, and arguably what a departing person expects. Rejected: the organization remains answerable for what was done under its roof, and deletion of released Session data is not something this product offers in any other path either.

**Stamp `archived` on each Session when a member is removed.** Direct, and a query reads one field. Rejected: it is a write per conversation at removal and another at restoration, and it creates a second source of truth that can disagree with the membership it was derived from.

## Acceptance criteria

- A Session created by a member records that member as its owner and that member's organization as it stood at creation; a Session created by an individual records the owner and no organization.
- The recorded organization does not change when the owner later joins, leaves, or moves between organizations.
- Ending a member's standing changes no Session record, and every Session that member owns reads as archived; restoring the standing returns them to active without touching those records.
- An organization can read the archived Sessions of its removed members.
- A Session carrying no ownership event — every Session written before this change — reads as unattributed, and no consumer infers an owner from who opened it later.
- The hosted product refuses to create a Session for a call that resolved no person.

## Risks

**The format change cannot be taken back.** Released Session data admits a version-named successor but never a rewrite, so the ownership event's shape must be right the first time. The event carries ids, not names: a person's display name and an organization's display name both change, and neither belongs in a record that is never rewritten.

**Archival derived from membership can drift from what people expect.** An administrator who removes a member sees their conversations become archived at once, including conversations in progress. Whether an in-flight conversation ends or finishes needs its own answer; this note does not give it one.

**The prerequisite is large.** Users, membership, and roles are a bigger body of work than this change, and this change cannot ship before them. Treating the Session format as ready while the user layer is still moving would freeze an identity shape that the user layer may still want to alter.

**Unattributed history stays unattributed.** Every Session written before this change has no owner, and no later process can supply one honestly. Consumers must show that absence rather than guess, which means the hosted product's first attribution reports start from the change rather than from the beginning.
