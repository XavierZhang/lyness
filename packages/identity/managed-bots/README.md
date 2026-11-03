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

**The character is recorded, not looked up again.** A session that speaks as a bot writes the character into its own log through `bot/engaged`, and a resume rebuilds the prompt from that. An administrator who rewrites a bot's character changes what it says next and must not change what it already said — and the repo's model-visible ⟺ logged rule requires it outright, since the character reaches the model.

**The character is a section of its own, appended after the preset's.** The preset says how the agent works, the bot says who is speaking. Appending cannot widen what the agent may do, which is what keeps prose written by a tenant administrator from reaching past the permission preset.

**Knowing a bot's id is not permission to be it.** Speaking as a bot is reaching its organization's work, so `engage` judges the standing the call acts in: an ordinary member of that organization may talk to its bots, a platform standing reaches every organization, and a standing from elsewhere is refused. This is not `administers` — talking to a bot is not an administrative act.

**A team is who may ask whom.** Two bots in one organization that share no team are not teammates: the relation an administrator wrote is the only thing that grants one bot the right to ask another, so a team holding a bot from elsewhere would hand that right across an organization boundary and is refused. What a teammate reads is a name, a job, a character and a preset — enough to decide who to ask, and no conversation of theirs.

**A teammate's job comes from its own record, not from the team.** A bot in two teams reads the same way in both. Letting a team restate what a member is for would make "what it does" depend on the company it is in, which is where a reader stops trusting either answer.

**Every change is recorded elsewhere, before it is read back here.** The roster holds what is true now; [`lyn-admin-audit`](../admin-audit/README.md) holds who changed it and what the change replaced. It is a hard injection, so a deployment that maintains bots without keeping their history fails to load rather than recording nothing in silence. A save that altered no field records nothing, because that is an administrator pressing Save without an edit.

**A record outlives the preset that runs it.** A preset the deployment stopped offering leaves the bot stored and `available: false`. Deleting it would lose the character an administrator wrote because a row left the profile.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-managed-people`](../managed-people/README.md) — the roster these join, and the admission table that refuses them.
- [`lyn-admin-audit`](../admin-audit/README.md) — the trail every change here is recorded in.
- [`lyn-agent-preset-registry`](../../preset/agent-preset-registry/README.md) — where the presets a bot may name come from.
- [`lyn-persona`](../../preset/persona/README.md) — the row that gives one agent its own system prompt, which a preset may carry beside a bot's character.
- [`lyn-api-session-controller`](../../api/session-controller/README.md) — where a conversation names the bot it is with.
- [Bots, their teams and their rooms](../../../.agents/notes/proposed/architecture/2026-10-22-bots-their-teams-and-their-rooms.md) — the design this package is the first part of.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it stores who the deployment's bots are, and nothing it holds reaches a model request on its own.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A bot is talked to, and does not act on its own** — a person opens a conversation with one; nothing lets a bot start one, be scheduled, or be reached from a chat tool.
- **Removing a bot leaves the teams that named it** — `teammates` skips a member nobody answers for, so the stale entry grants nothing, and it stays until somebody edits the team.
- **The preset is the whole capability selection** — individual skills, MCP servers, models and permission presets cannot be chosen per bot; a bot gets exactly what its preset composes.
- **One organization per bot** — a bot belongs to the deployment's one named organization, and a platform offering one bot to a named subset of its customers has no way to say so.
- **Removing a bot does not end the conversations it owns** — its identity is not reused, so they stay attributed to a bot that no longer runs, and a reader opening one finds a conversation nobody will answer in.
- **The stored record keeps only the current values** — a replacement overwrites the persona in place, so what it used to say is read from the [trail](../admin-audit/README.md) rather than from the roster.

**Runtime invariant:** No companion is published. The roster entries are derived from the stored records by this service alone, and the registrations are held in the same map that holds their disposers.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Hydration runs in `[Service.init]` rather than from the constructor, so a caller that has the service can resolve the owner of a conversation a bot opened; a roster filling in the background answers `undefined` to the first readers after every restart.

</details>
