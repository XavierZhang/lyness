---
description: "The language-server navigation module as its own bundle, shipped inert because a deployment supplies the server commands."
kind: "package-bundle"
---

# @lyness/lyn-module-lsp

English | [中文](README.zh.md)

## Summary

This bundle is the code-navigation default module: definitions, references, implementations, and hover from local language servers. The seam and its stdio provider are Host rows — one server per workspace, shared by every agent in it — while the query tool is per-agent and arrives through the [preset row contribution](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) seam.

Every row ships **disabled**, and that is structural rather than staged: `lsp-stdio` requires server commands this harness does not install, so no shipped value would work on an arbitrary machine.

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

The `web` profile template selects it, so a new profile has it available. A profile created before this bundle existed is normalized to the current template on its next start, because its previous exact bundle tuple is recorded as installation-owned.

Selecting the bundle does not switch the module on. Enable all three rows together, supplying the servers:

```yaml
- id: lsp
  disabled: false
- id: lsp-stdio
  disabled: false
  config:
    servers:
      typescript:
        command: typescript-language-server
        args: ['--stdio']
        extensionToLanguage:
          .ts: typescript
          .tsx: typescriptreact
- id: lsp-preset-contribution
  disabled: false
```

Enable them as a set. The contribution row alone publishes a tool with no provider behind it, which fails the session that calls it rather than the boot that composed it. Enabling `lsp-stdio` without a `servers` table fails loudly at load, which is the intended outcome: the table has no default because no default would be right.

Result bounds are set on the contribution row, because a contributed row has no id a later patch layer can target:

```yaml
- id: lsp-preset-contribution
  disabled: false
  config:
    maxLocations: 50
    maxResultChars: 8000
    timeoutMs: 30000
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

| Row | Module | Plane | Role |
|---|---|---|---|
| `lsp` | `@lyness/lyn-lsp` | Host | The seam: provider selection by extension and normalized results |
| `lsp-stdio` | `@lyness/lyn-lsp-stdio` | Host | Drives configured stdio server commands as providers |
| `lsp-preset-contribution` | `@lyness/lyn-lsp/preset-contribution` | contributes | Hands the `lsp` tool row to every accepting preset |

The contribution plugin lives beside the seam rather than in this bundle so that the plugin name resolves wherever the seam does. A bundle that named itself as a plugin would have to be resolvable as a module from wherever the Loader reads it, which a patch-carrying bundle otherwise never needs to be.

The plane split follows ownership: a language server is started per workspace and shared by every agent working in it, so one process owns the seam and the provider. Only the tool is per-agent, because a tool call belongs to the agent that made it. That is the same split [`lyn-module-memory`](../module-memory/README.md) uses, and the opposite of [`lyn-module-terminal`](../module-terminal/README.md), whose sessions belong to one agent each.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's three rows and a worked enabling example |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lsp/`](../../lsp/README.md) — the seam, the stdio provider, and the tool.
- [Preset row contributions](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.md) — why a module contributes a row instead of editing a preset.
- [`lyn-module-schedule`](../module-schedule/README.md) — the other module that ships available but inactive.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — why each default module is its own bundle.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: `lyn-tool-lsp` owns the `lsp` tool's schema, prompt guidance, and rendered results, and this bundle decides only whether a preset carries them.

#### KV Cache effect

No model request changes while the rows stay disabled, which is their shipped state, so selecting this bundle leaves the request prefix byte-identical. Enabling it adds one tool schema and its guidance to the prefix for every session on the profile — a one-time change at the point of enabling rather than a per-request one, and the contribution retires the mounted preset generation so the catalog settles once rather than shifting mid-session. Navigation results reach the model only as tool results, which sit after the prefix and invalidate nothing ahead of them.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **It ships inert and cannot ship otherwise** — the server commands are a deployment's to supply, and the bundle installs none. This is the reason the module is selected but off, not a staging decision to revisit.
- **The three rows are enabled independently** — nothing refuses the contribution row without the seam. Enabling only that one leaves a tool whose calls fail at the session.
- **Servers are not sandboxed by this bundle** — language-server processes and source reads share the mounted filesystem and subprocess environment, so confinement is the deployment's to add.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design.
- **Contribution order is centrally allocated** — this bundle's row sits at a fixed position the registry owns, so a deployment cannot reorder it relative to another module's contributed row.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the LSP seam publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the first module bundle whose inertness is structural rather than chosen, which is why its patch carries a worked enabling example instead of only a disabled flag. A reader who treats the disabled rows as a staging decision will try to switch them on by default and find no command to name.

</details>
