---
description: "The runtime self-modification module as its own bundle, whose tool row stays preset-declared so the capability remains developer-view only."
kind: "package-bundle"
---

# @lyness/lyn-module-extensions

English | [中文](README.zh.md)

## Summary

This bundle is the runtime self-modification default module: the agent reading and editing the composition it is running in. It carries the Host runner, the process-global inspect providers, the browser runner, and the view. Alone among the default modules it contributes no preset row — its `tool-cordis` row stays declared by the presets that should carry it, because a contribution reaches every accepting preset and would hand self-modification to the business view too.

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

Turn the module off from the **Plugins** page, or in a later patch layer:

```yaml
- id: cordis-host-runner
  disabled: true
- id: cordis-inspect-providers
  disabled: true
- id: cordis-client-runner
  disabled: true
- id: ui-cordis
  disabled: true
```

Disable the rows as a set, and disable the tool with them. The presets that declare `tool-cordis` are not reached by this bundle's patch, so turning off only these rows leaves a declared tool whose Host runner is gone — a call that fails in the session rather than at the boot that composed it. The developer view and upstream's `cordis` mode are the presets to edit.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

| Row | Module | Plane | Role |
|---|---|---|---|
| `cordis-host-runner` | `@lyness/lyn-cordis-host-runner` | Host | Runs composition reads and edits |
| `cordis-inspect-providers` | `@lyness/lyn-tool-cordis/host` | Host | The inspect providers the tool rows read |
| `cordis-client-runner` | `@lyness/lyn-cordis-client-runner` | browser | The browser half of the runner |
| `ui-cordis` | `@lyness/lyn-client-ui-cordis` | browser | The composition view |

The inspect providers are process-global: the registry rejects a duplicate id, so they register once here and every preset's `tool-cordis` row reads them. That is why they are a Host row rather than part of the per-agent tool.

The absent contribution is the point of interest. Every other default module hands its tool row to the contribution seam, which reaches each preset that accepts rows. Self-modification is scoped to the developer view, so a blanket contribution would be a capability change rather than a repackaging. Until a preset can accept one contribution class without accepting all of them, the tool row stays where the capability boundary already is.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's four rows |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`extensions/`](../../extensions/README.md) — the runners, the tool, and the view.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — which view carries which capability.
- [Preset row contributions](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) — the seam this module deliberately does not use.
- [`lyn-module-deliverables`](../module-deliverables/README.md) — the module whose contributed row coexists with preset-declared ones.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: `lyn-tool-cordis` owns the composition tool's schema and results, and this bundle supplies the Host runner and inspect providers those calls depend on.

#### KV Cache effect

Selecting the bundle changes no request prefix, because the tool schema comes from a preset's own declared row rather than from this patch; a profile that selects the bundle and uses a preset without that row sends exactly the catalog it sent before. Composition reads and edits reach the model as tool results, which sit after the prefix and invalidate nothing ahead of them.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **The tool row is not in this bundle** — disabling these rows without editing the presets leaves a declared tool with no Host runner, failing at the call rather than at the boot.
- **A contribution would widen the capability** — the seam reaches every accepting preset, so this module cannot use it without giving the business view self-modification. A per-class opt-in on the preset side would remove this exception.
- **The inspect providers are process-global** — a second row with the same id is rejected, so a deployment mounting its own must disable this one first.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the runners publish their own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This module is the counter-example that bounds the contribution seam: it shows the seam's reach is all-or-nothing per preset, which is fine for a tool every view should have and wrong for one only the developer view should. If a per-class opt-in is ever added, this bundle is the first that should use it.

</details>
