---
description: "The persistent terminal module as its own bundle, contributing one per-agent shell group to every accepting preset."
kind: "package-bundle"
---

# @lyness/lyn-module-terminal

English | [中文](README.zh.md)

## Summary

This bundle is the persistent terminal default module: interactive shells that keep their working directory, environment, and running children across tool calls. Every row of the capability is per-agent, so unlike [`lyn-module-memory`](../module-memory/README.md) it inserts no Host row — it contributes one isolate group, which is what the [preset row contribution](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) seam carries. It ships switched on; the view defaults previously declared this group inline, and moving it here is what lets the platform version it apart from the product.

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

The `web` profile template selects it, so a new profile has it. A profile created before this bundle existed is normalized to the current template on its next start, because its previous exact bundle tuple is recorded as installation-owned — the capability is not lost by the repackaging.

Turn the module off from the **Plugins** page, or in a later patch layer:

```yaml
- id: terminal-preset-contribution
  disabled: true
```

One row disables the whole capability, because one row is all it mounts.

The command timeout is a deployment value, not a constant. A patch replaces the row's complete config, so set it whole:

```yaml
- id: terminal-preset-contribution
  config:
    timeoutMs: 900000
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

The patch inserts one row, `@lyness/lyn-terminal/preset-contribution`, which resolves wherever the terminal service does. A bundle that named itself as a plugin would have to be resolvable as a module from wherever the Loader reads it, which a patch-carrying bundle otherwise never needs to be; naming the service package instead makes the contribution resolve exactly where the service already does.

The contributed row is a `cordis:group` carrying `isolate: { terminals: true }`, with four children:

| Child | Module | Role |
|---|---|---|
| `pty` | `@lyness/lyn-terminal` | Owner-scoped session service |
| `terminal-bash` | `@lyness/lyn-terminal-bash` | Interactive bash; disabled on Windows |
| `terminal-pwsh` | `@lyness/lyn-terminal-bash` | The same plugin in pwsh dialect; disabled off Windows |
| `tool-terminal` | `@lyness/lyn-tool-terminal` | The six `terminal_*` tools |

Both shell rows are kept rather than resolving the platform into one row, so a deployment can override either by id from a later patch layer. Exactly one is enabled, because two would open two shells for one agent.

The whole group is per-agent because a terminal belongs to the agent that opened it, and the isolate is what stops one agent reading another's screen. That is the opposite split from memory, whose store has a single owner and so stays on the Host plane.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's one row and its deployment values |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`terminal/`](../../terminal/README.md) — the session service, the shell backend, and the tools.
- [Preset row contributions](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) — why a module contributes a row instead of editing a preset.
- [`lyn-module-memory`](../module-memory/README.md) — the Host-plane counterpart, for the plane split.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — why each default module is its own bundle.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the row it inserts: `lyn-tool-terminal` owns the six `terminal_*` schemas and their results, and this bundle decides only whether a preset carries them.

#### KV Cache effect

Selecting the bundle adds six tool schemas to the request prefix for every session on the profile, which is a one-time change at the point of selection rather than a per-request one; the contribution arrives after the presets mount and retires the mounted generation, so the catalog settles once at boot rather than shifting mid-session. Nothing in the group contributes runtime context, so a session that opens no terminal has the same prefix as one without this bundle, and screen contents reach the model only as a tool result, which sits after the prefix and invalidates nothing ahead of it.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **Sessions do not survive a restart** — they are local to one harness process, so a profile restart loses every open shell. That is the service's property, not the bundle's.
- **One timeout serves both dialects** — the config field reaches bash and pwsh alike; a deployment needing different ceilings overrides a shell row by id instead.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design, so a hand-edited profile adds this bundle by hand too.
- **Only the `web` template selects it** — a custom profile adds it to its own `lyn.profile.bundles`.
- **Contribution order is centrally allocated** — this bundle's row sits at a fixed position the registry owns, so a deployment cannot reorder it relative to another module's contributed row.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the row it inserts is observed by the Loader, and the terminal service publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the first contribution to carry a group rather than a single row, which is what proves `ContributedRow` is the full preset row type and not a flat plugin reference. A change to how a contributed group isolates or orders its children shows up here first.

</details>
