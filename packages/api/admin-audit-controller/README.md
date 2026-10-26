---
description: "The surface administrators read the history of their own changes through."
kind: "package-reference"
---

# @lyness/lyn-api-admin-audit-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-admin-audit-controller` owns the `audit` Remote namespace: one read that answers the recorded changes a standing may see, newest first, with who made each one and both sides of every field that differs. It decides nothing about who may read what — [`lyn-admin-audit`](../../identity/admin-audit/README.md) holds that rule, and this namespace hands it the standing the call acts in. What it does resolve is which organization an unnamed read means: the caller's own, so a tenant administrator does not type the one organization they administer into every read.

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

The accounts module mounts it beside the trail it speaks for:

```yaml
- id: admin-audit-controller
  name: '@lyness/lyn-api-admin-audit-controller'
```

A configuration surface reads a page, or one record's own history:

```ts
import type { AuditEntryView, AuditQueryInput } from '@lyness/lyn-api-admin-audit-controller/types'

/** The one read a history view makes. */
export interface HistoryView {
  readonly read: (query: AuditQueryInput) => Promise<readonly AuditEntryView[]>
}
```

Each refusal arrives under its own code — `audit/not-permitted` and `audit/no-standing` — so a surface hides a page rather than matching prose.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The authority is the trail's.** Naming an organization asks for that organization's trail; naming none asks for every organization's, which only a platform standing administers. A second copy of that rule written here would be one to keep in step with the first, and the one a direct caller bypasses.

**An unnamed read means the caller's own organization.** A tenant administrator holds exactly one, and typing it into every read would be a field that can only hold one value. A platform standing holds none, so an unnamed read stays the every-organization read — the same answer the trail already refuses to anybody else.

**The page is clamped by the deployment, not by the caller.** `limit` asks; the trail answers at most what the deployment keeps. Asking for more is a shorter page rather than a refusal, so a surface does not have to know the bound to make a valid request.

**A failure that is not a refusal reaches the caller as itself.** Only the trail's own closed reason is mapped to a code; a storage failure is not dressed up as an authorization one.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-admin-audit`](../../identity/admin-audit/README.md) — the trail this namespace reads, and the rule it hands the standing to.
- [`lyn-request-principal`](../../identity/request-principal/README.md) — where the standing one call acts in comes from.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects it beside the trail.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers one administrative read over the Remote protocol, and nothing it returns reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One read, and no cursor** — a page is the newest entries the deployment answers with; there is no range, no continuation and no filter by who made the change or what kind of record it was.
- **No export** — an auditor who wants the trail as a file has to read it a page at a time through this namespace.
- **No subscription** — a surface showing the trail re-reads it; nothing tells it a new entry arrived.

**Runtime invariant:** No companion is published. This namespace holds no state of its own; every answer is projected from the trail's own read.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`organizationOf` is exported so the one resolution this namespace owns is testable on its own, rather than only through a booted deployment.

</details>
