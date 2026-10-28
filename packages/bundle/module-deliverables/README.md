---
description: "The turn deliverables module as its own bundle: the changed-files recorder, its card, and the present tool for accepting presets."
kind: "package-bundle"
---

# @lyness/lyn-module-deliverables

English | [中文](README.zh.md)

## Summary

This bundle is the turn deliverables default module: what a turn hands to the user. The changed-files recorder and its turn-tail card are Host and browser rows, while the `present` tool is per-agent and reaches accepting presets through the [preset row contribution](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) seam. It ships switched on, and bundles two independent features under one switch: the agent declaring deliverables, and the workspace recording what changed.

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

The `web` profile template selects it, so a new profile has it. A profile created before this bundle existed is normalized to the current template on its next start, because its previous exact bundle tuple is recorded as installation-owned.

Turn parts of it off from the **Plugins** page, or in a later patch layer:

```yaml
- id: ui-deliverables
  disabled: true
- id: workspace-changes
  disabled: true
- id: deliverables-preset-contribution
  disabled: true
```

The three rows are genuinely independent. Disabling the card alone leaves the tail hole rendering empty while the events still accumulate; disabling the recorder alone stops the changed-files events; disabling the contribution alone removes `present` from the view defaults without touching the official modes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

| Row | Module | Plane | Role |
|---|---|---|---|
| `ui-deliverables` | `@lyness/lyn-client-ui-deliverables` | browser | Turn-tail changed-files and delivery cards |
| `workspace-changes` | `@lyness/lyn-workspace-changes` | Host | Records each turn's changed files from git snapshots |
| `deliverables-preset-contribution` | `@lyness/lyn-tool-present/preset-contribution` | contributes | Hands the `present` row to every accepting preset |

The contribution reaches only presets that accept rows, and that asymmetry is deliberate. The four official modes declare `@lyness/lyn-tool-present` as a row of their own, as upstream ships them, and keep it; a contribution reaching them would be a second row registering one tool name. So `standard`, `ptc`, and `cordis` carry the declared row while the view defaults carry the contribution, and every preset still ends with exactly one.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's three rows |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`deliverables/`](../../deliverables/README.md) — the `present` tool and the changed-files recorder.
- [Preset row contributions](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) — why a module contributes a row instead of editing a preset.
- [Web deliverables](../../client/ui-deliverables/README.md) — the cards this bundle mounts.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — why each default module is its own bundle.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: `lyn-tool-present` owns the `present` schema and its results, and the recorder contributes a durable event that only clients read.

#### KV Cache effect

The contribution adds one tool schema to the request prefix for sessions on an accepting preset, which is a one-time change at the point of selection rather than a per-request one; the official modes already carried that schema from their own declared row, so for them the prefix is unchanged. The recorder contributes no prompt text and no runtime context — its `workspace/changes` event is read by clients, never folded into a request — so it leaves the prefix byte-identical.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **One switch covers two independent features** — declaring deliverables and recording changes share a module because they share a subject, not a mechanism. A deployment wanting only one disables the other's row.
- **The contribution does not reach the official modes** — they keep their own declared row, so disabling this bundle's contribution changes the view defaults only.
- **The recorder needs git for full coverage** — without a repository or git, only file-tool edits are listed. That is the recorder's property, not the bundle's.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design.
- **Contribution order is centrally allocated** — this bundle's row sits at a fixed position the registry owns, so a deployment cannot reorder it relative to another module's contributed row.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the recorder publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the first module whose contributed row coexists with the same plugin declared in other presets, which is what makes the registry's duplicate-id and declared-row collision checks load-bearing rather than theoretical.

</details>
