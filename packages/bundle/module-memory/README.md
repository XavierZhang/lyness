---
description: "The durable memory module as its own bundle, whose write tools reach every accepting preset through the contribution seam."
kind: "package-bundle"
---

# @lyness/lyn-module-memory

English | [中文](README.zh.md)

## Summary

This bundle is the durable memory default module: the Host [Memory service](../../memory/memory/README.md) and the preset contribution carrying its write tools into the agent catalog, as one unit a profile selects. It is the first user of the [preset row contribution](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) seam, so it is the worked example of adding a tool without restating a preset's row list.

Unlike [`lyn-module-schedule`](../module-schedule/README.md), it ships switched **on**: an empty store contributes nothing to a request, so selecting it before anyone writes a fact costs zero prompt bytes.

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

Both rows are on. Turn the module off from the **Plugins** page, or in a later patch layer:

```yaml
- id: memory
  disabled: true
- id: memory-preset-contribution
  disabled: true
```

Disable them as a pair. The contribution row alone leaves the tools in the catalog with no service behind them, which fails the session that calls one rather than the boot that composed it.

Retention and prompt placement are the service's configuration, not this bundle's; the bundle inserts the rows and sets nothing.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

The patch inserts two rows, and both name `@lyness/lyn-memory`:

| Row | Module | Role |
|---|---|---|
| `memory` | `@lyness/lyn-memory` | The Host service: one durable store, one domain owner |
| `memory-preset-contribution` | `@lyness/lyn-memory/preset-contribution` | Contributes the `memory_*` tool row to every accepting preset |

Neither row names this bundle. A bundle that named itself as a plugin would have to be resolvable as a module from wherever the Loader reads it, which a patch-carrying bundle otherwise never needs to be; naming the service package instead makes the contribution resolve exactly where the service already does.

The two rows exist because the service and its tools live on different planes. The service is Host-plane, so one process holds one store and one domain owner. The tools are per-agent, because a tool call belongs to the agent that made it. A single preset-scoped service would give every agent its own handle on the same storage domain, which is the state this split exists to prevent.

The contribution arrives after the presets mount — module bundles load after the surface bundle — so it retires the mounted generation rather than patching it. That ordering is the seam's documented behavior, not a property of this bundle.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's two rows |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-memory`](../../memory/memory/README.md) — the service, its storage domain, and its tools.
- [Preset row contributions](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) — why a module contributes a row instead of editing a preset.
- [Memory, recall, and prompt assembly](../../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.md) — what memory is for and what it is not.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — why each default module is its own bundle.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: the Memory service owns the three `memory_*` tool schemas and the remembered-facts context block, and contributes them only on a profile that selects this bundle.

#### KV Cache effect

Selecting the bundle adds three tool schemas to the request prefix for every session on the profile, a one-time change at the point of selection rather than a per-request one. The remembered block is runtime context, re-evaluated at every assembly, and sits after the stable sections: an empty store renders nothing, so a profile that has never written a fact has a byte-identical prefix to one without this bundle, and each write invalidates the context tail from that block onward — which is why the block is bounded to the newest entries and states how many it left out instead of growing with the store.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **The two rows are disabled independently** — nothing refuses the contribution row without the service. Turning off only one leaves tools whose calls fail at the session rather than at the boot.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design, so a hand-edited profile adds this bundle by hand too.
- **Only the `web` template selects it** — a custom profile adds it to its own `lyn.profile.bundles`.
- **Contribution order is centrally allocated** — this bundle's row sits at a fixed position the registry owns, so a deployment cannot reorder it relative to another module's contributed row.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the Memory service publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the first consumer of the preset contribution seam. A change to how contributions merge, order, or retire a generation shows up here first, so this bundle's web snapshot is the one to read when that seam moves.

</details>
