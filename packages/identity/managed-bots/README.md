---
description: "The bots a deployment's administrators maintain at runtime, each one an entry in its organization's roster."
kind: "package-reference"
---

# @lyness/lyn-managed-bots

English | [中文](README.zh.md)

## Summary

`lyn-managed-bots` is where a deployment's bots come from when nobody is editing a composition file. An administrator names one, writes its character and what it is for, and picks one of the agent presets the deployment offers; the bot then joins its organization's roster, holding a member standing and owning the conversations it opens. A tenant administrator maintains their own organization's bots and nobody else's. A bot never becomes somebody who signs in — no directory can authenticate one — nor an administrator, because its standing is fixed here rather than submitted.

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

Beside the roster and the preset registry whose presets a bot may name:

```yaml
- id: managed-bots
  name: '@lyness/lyn-managed-bots'
```

An administrator then adds them:

```ts
import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-managed-bots'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.managedBots.save({
  displayName: 'Triage',
  organization: 'acme',
  persona: 'You answer in short sentences and ask before acting.',
  job: 'Reads incoming reports and files them.',
  preset: 'standard',
}, by)
```

Replacing one keeps its id, so the conversations it already owns stay its own. A bot composition wrote is listed and refused every change, because the file is read again at every boot.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**A bot is an entry in the roster, not an object in a process.** It is registered with [`lyn-managed-people`](../managed-people/README.md) as a person of kind `bot`, so attribution, visibility and every surface that resolves an owner reach it without a second mechanism. Modelling it as a process-local object is what the multi-agent frameworks do, and it would make the bot the one actor in the product with no standing and nothing recorded against it.

**Its standing is fixed, not submitted.** Every bot holds `member`. A persona is free text written by a tenant administrator, and a bot that administered anything could be talked into adding a person or changing a standing. Nothing a deployment gains from an administrator bot is worth that.

**It is never admitted.** The roster answers it and the admission table refuses it, so no directory identity can sign in as one. A table that stored bots as people would be a table the admission path reads.

**Its capabilities are selected, never written.** The preset names a composition the deployment already mounted. A free-text capability would let an administrator name a plugin nobody audited, which is the same reason the sign-in kinds row exists: the deployment states what is on offer, the tenant picks from it.

**A change is authorized against what is stored as well as what was submitted**, or one tenant's administrator could claim another's bot by naming its id with their own organization.

**A record outlives the preset that runs it.** A preset the deployment stopped offering leaves the bot stored and `available: false`. Deleting it would lose the character an administrator wrote because a row left the profile.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-managed-people`](../managed-people/README.md) — the roster these join, and the admission table that refuses them.
- [`lyn-agent-preset-registry`](../../preset/agent-preset-registry/README.md) — where the presets a bot may name come from.
- [`lyn-persona`](../../preset/persona/README.md) — the row that gives one agent its own system prompt.
- [Bots, their teams and their rooms](../../../.agents/notes/proposed/architecture/2026-10-22-bots-their-teams-and-their-rooms.md) — the design this package is the first part of.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it stores who the deployment's bots are, and nothing it holds reaches a model request on its own.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A stored bot does not run yet** — the roster answers it and an administrator maintains it, but nothing mounts its persona and preset into a session. Opening a conversation with one is the next part of the design.
- **The preset is the whole capability selection** — individual skills, MCP servers, models and permission presets cannot be chosen per bot; a bot gets exactly what its preset composes.
- **No teams and no rooms** — a bot cannot ask another bot anything, and several of them cannot discuss one question. Both are later parts of the same design.
- **One organization per bot** — a bot belongs to the deployment's one named organization, and a platform offering one bot to a named subset of its customers has no way to say so.
- **Removing a bot does not end the conversations it owns** — its identity is not reused, so they stay attributed to a bot that no longer runs, and a reader opening one finds a conversation nobody will answer in.
- **No audit of its own** — a record names who added it and when, and a replacement overwrites the persona without keeping what it was.

**Runtime invariant:** No companion is published. The roster entries are derived from the stored records by this service alone, and the registrations are held in the same map that holds their disposers.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Hydration runs in `[Service.init]` rather than from the constructor, so a caller that has the service can resolve the owner of a conversation a bot opened; a roster filling in the background answers `undefined` to the first readers after every restart.

</details>
