---
kind: upgrade-guide
description: "The Web composition offers two agent views, work and build, and keeps the four mode ids registered but unoffered."
---

# Two offered agent views

English | [中文](guide.zh.md)

## Change

`@lyness/lyn-web-app` offers two presets to a person starting a task: `work` for everyday work and `build` for development. The ids `standard`, `ptc`, `minimal` and `cordis` now declare `offered: false`. They stay registered, resolvable and mountable — a session recorded under one of them still reopens, and `agentPresets.resolve('ptc')` still answers — but no surface a person uses lists them: the chooser, the Agent presets settings page and the plugin inventory page all read the same filtered roster, because `AgentPresetRegistry.remoteExportList` filters at the producer.

The registry default moved from `standard` to `work`. A personal default saved as one of the four unoffered ids is ignored and the deployment default applies, so a profile carrying `selectedDefault: ptc` no longer opens every new task in a mode its own menu omits. A saved id that no declaration carries still wins, as before.

`work` and `build` no longer restate their rows. `work` declares `extends: standard` and `build` declares `extends: cordis`, and each carries only its difference: a row whose id matches one of the base's replaces it in place, and any other row follows the base's list. Both views therefore mount the base mode's current rows, including rows an upgrade adds to it.

`PresetDefinition` gains `extends` and `offered`; `@lyness/lyn-agent-preset` accepts both as config. A contribution whose plugin a preset's rows already name is dropped, so a view extending a mode that declares `@lyness/lyn-tool-present` does not take the deliverables module's copy as well.

## Migration

1. A deployment that wants one of the four ids in front of people sets `offered: true` on that `@lyness/lyn-agent-preset` row in its own patch layer.
2. A deployment whose registry row still reads `default: standard` sets `default: work`, or any id it offers; a default that is not offered puts an unlisted mode in front of every new session.
3. A composition that copied `work` or `build` to change a row replaces the copy with `extends` plus the rows it changes, and drops the rest.
4. Start the Web app and read the roster: `agentPresets/list` answers with `work` (default) and `build` only, neither carrying `broken`.
