# Agent Note: The session log carries the tenant and the identity text it ran under

Status: implemented

English | [中文](2026-09-20-tenant-in-the-session-log.zh.md)

## Problem

A deployment serving several organizations has to be able to say, long after a session ended, whose session it was. Nothing in the log said so.

Identity has the stricter requirement. A tenant contributes constraints and a voice to its own model requests, and this repository's standing rule is that anything reaching a model request must be reconstructable from the session log. A tenant edits its own configuration; a log that named only the tenant would, after such an edit, reconstruct a session with text that session never ran under.

The obvious home is closed. `SessionHeader` is a fixed field list copied out of a closed `meta` whitelist, and the physical JSONL header rejects any key outside its own set, so adding a field there is a structural format change: a `SESSION_FORMAT_VERSION` bump with an adjacent migration package.

## Decision

One log-only event, `tenant/identity`, appended once per session on `session/created` by `@lyness/lyn-tenant-session`. It carries a versioned explicit field set — the tenant id, the slug as it read at creation, and the tenant's constraints and personality verbatim. Adding an event type needs no format bump; the per-event `ignorable` guard covers vocabulary growth.

The identity text is recorded in full rather than by reference. The repository has two shapes for recording what reached a model — verbatim text when the text is the thing, and a resolvable id when it is resolvable — and a tenant's identity is the first kind: the configuration it came from is mutable, so an id does not resolve to what the session actually ran under.

A `tenant` session projection folds the record back, and its state is also the idempotence guard: a session whose fold already holds a record is left alone, so a fork and a resumed session keep the stamp they were created with.

The tenant comes from the plugin's configuration, one per deployment. Session creation carries no tenant: the browser's create call crosses the wire as a payload the gateway dispatches without headers, and the tenant is only knowable where raw headers exist. Making that request's tenant reach session creation means editing the create request type, the Remote method, and the browser client — three upstream files — which waits until the administration surface needs them anyway.

## Alternatives considered

**Put `tenantId` in the session header.** It is where a session's immutable facts live, and every reader already parses it. The header's logical and physical shapes are both closed, so this is a structural change: a format bump, a new migration package, and a re-cut of every retained snapshot generation — for a field one event records just as durably.

**Record the tenant id alone.** Smaller events, and the tenant's current identity is one lookup away. The lookup answers what the tenant configures *now*; the session ran under what it configured *then*, and the gap between them is exactly what an audit asks about.

**Record a hash of the identity text.** It would prove which text ran without storing it twice. No first-party plugin records a hash, a hash cannot be read back into a prompt, and the text is already in the log verbatim inside the assembled system prompt — the hash would prove agreement with something unreadable.

**Carry the tenant in the session-create request now.** The stamp would be per request rather than per deployment, which is what SaaS needs. It edits three upstream files this fork would then carry through every merge, and the administration surface that will need the same plumbing has not landed; doing it once, later, costs less than doing it twice.

## Consequences

The stamp is correct for a deployment serving one tenant and incomplete for one serving several: every session records the configured tenant. A deployment must not compose this plugin as if it disambiguated tenants.

The identity is read once when the plugin starts. The read-only configuration backend cannot change under a running process, so this matches what a deployment can actually do today; a writable backend will have to re-read.

No shipped bundle composes the tenant plugins, so the recorded-session snapshots are untouched. Adding them to the Web application bundle would change the log every comparing scenario produces, which means refreshing the snapshot corpora and both SDK projections in the same change.
