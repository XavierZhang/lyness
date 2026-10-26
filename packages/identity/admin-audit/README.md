---
description: "The append-only trail of administrative changes: who changed which record, when, and from what to what."
kind: "package-reference"
---

# @lyness/lyn-admin-audit

English | [中文](README.zh.md)

## Summary

`lyn-admin-audit` keeps the half a roster does not. A roster holds what is true now, which is enough to serve a request and not enough to answer for one: an organization asked why somebody held a role last month, or what a bot's character used to say, has nothing to read if the only record is the current one. Every change to a person, a directory binding, a bot or a team is recorded here with who made it, the standing they made it in, and the value it replaced. Entries are only ever appended; nothing rewrites or removes one.

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

Before the rosters, because both of them inject it:

```yaml
- id: admin-audit
  name: '@lyness/lyn-admin-audit'
  config:
    maxValueLength: 2000
    maxEntries: 200
```

An owner of administrable records then records its own changes, and a surface reads them back:

```ts
import type { Context } from '@lyness/cordis'
import { fieldChanges } from '@lyness/lyn-admin-audit'
import type {} from '@lyness/lyn-admin-audit'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.adminAudit.record({
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'changed',
  organization: 'acme',
  changes: fieldChanges({ persona: 'Be brief.' }, { persona: 'Be thorough.' }),
}, by)

const history = await ctx.adminAudit.read({ organization: 'acme', subject: 'triage' }, by)
```

A tenant administrator reads their own organization's trail. Naming no organization asks for every organization's, which only a platform standing may do.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Its own domain, kept apart from the records it describes.** A roster's tables hold what is true now and are rewritten in place; this one is only ever appended to. A trail sharing a domain with the records it audits would be removed by the same administrator action that made it worth keeping.

**Nothing is authorized when recording.** The operation that made the change already decided it was permitted, and a trail that could refuse an entry would be a trail with changes missing from it. Authority appears on the read instead, where one predicate serves both readings: naming an organization asks for that organization's trail, naming none asks for every organization's.

**A hard injection, not an optional read.** Each roster declares `adminAudit`, so a deployment mounting one without it fails to load. The alternative — a roster that silently records no history — is the shape of problem the credits enforcement avoids the same way: visibly absent beats quietly inactive.

**The value a change replaced is the point.** An auditor asking what a persona used to say needs the prose that is gone, so both sides of each differing field are recorded. Only `after` is kept for an addition and only `before` for a removal, because the record existing or not is itself the change.

**Comparison lives here, once.** Every owner of administrable records needs the same field-by-field comparison, and a second copy would drift. A caller flattens its record into named strings — joining a list, omitting a field it does not carry — and `fieldChanges` answers what an auditor would read out.

**A recorded value is cut, and says that it was.** A persona is free text an administrator wrote, so one record can carry more prose than a trail should grow by. The cut is marked on the field rather than hidden, so a reader knows it is reading part of a value.

**A change that altered nothing is not recorded.** Both rosters skip a `changed` submission with no differing fields, because that is an administrator pressing Save without an edit and the entry would be one an auditor has to read past.

**The entry id leads with the instant.** The stored key sorts by time, which is the order every read wants; the suffix separates two changes made in the same millisecond. A read sorts on the key rather than re-deriving an order from the record.

**The name is kept beside the identity.** An entry carries the name the record went by at the time, so the history of a removed bot still reads as a name rather than as an identifier nothing resolves.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-managed-people`](../managed-people/README.md) — the people and bindings whose changes it records.
- [`lyn-managed-bots`](../managed-bots/README.md) — the bots and teams whose changes it records.
- [`lyn-people`](../people/README.md) — the standings a read is authorized against.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects it beside the rosters.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it stores what administrators changed, and nothing it holds reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The whole trail is loaded at open** — the domain is a key-value table read into memory, so a long-lived deployment's trail is held in full and a read sorts it. A trail that outgrows that wants a time-ranged query against a store that can answer one.
- **Entries are never pruned** — the trail is the product, so retention is a deployment policy rather than a default this package picks.
- **No surface reads it** — the service answers a standing, and no Remote namespace or settings page shows the trail yet, so today it is readable only from code.
- **Only the rosters record into it** — sign-in channel changes, settings, credit grants and model selections are administrative too, and none of them record here yet.
- **A read is one page, newest first** — there is no cursor, no range and no filter by who made the change or what kind of record it was.
- **The trail says what changed, not what was attempted** — a refused change records nothing, so an administrator repeatedly denied a change leaves no trace here.

**Runtime invariant:** No companion is published. The trail is the only record of its own content, so there is no independent observation that could disagree with it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The service takes its bounds as a validated `Config`, and the Loader supplies them from the composition row: a row that states no `config` key leaves the plugin unmounted, which is why the accounts module states both bounds explicitly and the test benches pass `{}`.

</details>
