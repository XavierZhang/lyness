# Agent Note: How a module bundle adds a tool to a preset it does not own

Status: proposed

English | [中文](2026-10-10-preset-row-contributions.zh.md)

## Problem

[Each default module is its own shipped bundle](2026-10-08-default-modules-and-views.md), which is what gives the platform an upgrade path for one module without a release of the whole product. Half the modules cannot be packaged that way.

A module that contributes a model-facing tool has its row inside an agent preset. A preset is one `@lyness/lyn-agent-preset` row whose `config.plugins` holds the whole list, and [a patch replaces the targeted row's whole `config`](../../../../packages/bundle/web-app/README.md). So a separate bundle wanting to add one tool to `work` would have to restate every row `work` already has. That is not packaging; it is copying, and the copy goes stale the first time the preset changes.

The split is clean and unhelpful. The agent terminal, language servers, computer use, browser use, turn deliverables, runtime self-modification, and durable memory's write tools all live on the preset plane. The remaining modules are host-plane and package as bundles today. Six of twelve are blocked on a mechanism that does not exist.

The obvious workaround makes it worse. Leaving a module's tools in the profile bundle while its service ships separately means the unit a customer selects is no longer the module: switching the module off would leave its tools registered against a service that is gone.

## Proposal

A module bundle contributes rows **into** a preset, and the preset registry merges them.

### A contribution names its target class, not a preset id

A contribution declares which presets it joins by **class** — the presets that serve people — rather than by listing ids. A module should not have to know which view defaults exist, and a deployment that adds a preset should not have to edit every module.

The four preset ids the official modes use receive no contributions. They are preserved as upstream shipped them, which is the commitment [the preset work](2026-10-08-default-modules-and-views.md) made when it added `work` and `build` beside them; a module that wants to reach them is asking for a different preset, not a contribution.

### Position comes from a central allocation

A contributed row's place in the tool order is allocated centrally, the way [`lyn-system-prompt`](../../../../packages/core/system-prompt/README.md) already allocates prompt-section and runtime-context positions. Arrival order must not decide it: the tool catalog's order is part of the request prefix, so two deployments with the same modules switched on have to produce the same catalog, in the same order, or they produce different caches for identical configuration.

### A duplicate id fails at mount

Two contributions claiming one row id is a composition error, not a last-writer-wins merge. It fails when the preset mounts, which is the earliest point at which both are known, and the failure names both contributors.

### A contribution is an effect

Switching the module bundle off withdraws its rows, because the contribution registers through `ctx.effect()` like every other registration. There is no second removal path, and no state survives the module that owns it.

### Host and preset planes stay distinct

A module bundle may carry both: host rows in its own patch layer, preset rows as contributions. What it must not do is register a tool whose service it did not also mount — the failure a customer would see is a tool that exists and cannot work, and the mount is where that pair is checkable.

## Alternatives considered

**Merge `config.plugins` by row id in the Loader.** The smallest change in appearance: patches would merge arrays instead of replacing them. Rejected: "a patch replaces the targeted row's whole `config`" is relied on across the tree, and changing it to make one field special would change how every existing patch layer resolves.

**Ship one preset per module.** Then nothing merges, because every module owns its own preset. Rejected: a preset is a mode a person chooses, not a module manifest, and twelve modules would mean twelve modes nobody asked for.

**Keep every tool row in the profile bundle.** No new mechanism at all, and the module's service still ships separately. Rejected: the unit a customer selects stops being the module, and switching one off leaves its tools registered against an absent service.

**Let a contribution name preset ids.** More explicit, and a module could target exactly one mode. Rejected: every module would then carry a list that goes stale when a deployment adds a preset, and nothing would stop a module from reaching into the four preserved official modes.

**Order contributions by bundle selection order.** It needs no central allocation and the ordered bundle list already exists. Rejected: the tool catalog's order is part of the request prefix, so two deployments with the same modules on but selected in a different order would produce different caches for identical configuration.

## Acceptance criteria

- A module bundle adds a tool row to the presets that serve people without restating any row it does not own.
- The four preset ids the official modes use receive no contributed rows.
- A contributed row's position comes from a central allocation, and two deployments with the same modules switched on produce byte-identical tool catalogs.
- Two contributions claiming one row id fail when the preset mounts, and the failure names both contributors.
- Switching a module bundle off removes its contributed rows with no second removal path.
- A contribution whose service the same bundle does not mount is refused at mount rather than producing a tool that cannot work.

## Risks

**Preset composition stops being readable in one file.** Today `work.patch.yml` shows everything `work` has. With contributions, reading it is no longer enough: a reader also needs the list of selected module bundles. The development view is where the resolved composition has to be legible, and until it is, this trades one kind of clarity for the packaging.

**A module switch changes the request prefix.** Contributing a tool changes the catalog, so switching a module on invalidates the cached prefix for every session on that profile. That is correct and unavoidable; it is worth stating because a module switch now has a cost that a host-plane-only switch did not.

**Snapshot expectations gain a dependency.** Every preset snapshot's tool catalog becomes a function of which module bundles are selected, so a snapshot that pins a catalog pins that selection too. The pinned selection has to be visible in the scenario rather than implied by the default profile.

**The central allocation is a bottleneck by design.** Every module contributing a tool needs a position allocated in one place, so two modules developed in parallel touch the same table. That is the same cost the prompt-section allocation already pays, accepted for the same reason.
