---
kind: upgrade-guide
description: "agentCapabilities/describe reports tools grouped by the plugin that registered them, with no per-tool description."
---

# `agentCapabilities/describe` groups tools by plugin

English | [中文](guide.zh.md)

## Change

The `tools` member of the `agentCapabilities/describe` reply changes from one row per tool to one row per registering plugin, and each tool's own description is gone:

| Before (`ToolAvailabilityView`) | After (`ToolPluginView`) |
|---|---|
| `name` — the tool's model-facing name | `plugin` — the registering plugin's display name |
| `description` — the model-facing prose | `meta?` — that package's own `PluginLocalizedMeta` (title, description, icon) |
| `source` | `tools` — the model-facing names it registered, in name order |
| | `source` |

`connections` and `skills` are unchanged. `ToolAvailabilityView` is no longer exported; `ToolPluginView` replaces it.

This affects any client plugin, SDK consumer, or JSON-RPC caller reading `describe().tools`. The description was removed rather than moved: it is written for a model, and a surface for people that rendered it showed prose about arguments and exit codes in one language regardless of the reader's.

The Host-side registry gained `ctx.tools.registered(scope?)`, which pairs each visible definition with the Fiber that registered it. `ctx.tools.definitions(scope?, toolSet?)` is unchanged.

## Migration

1. Read the group, not the tool: `view.tools.flatMap(group => group.tools)` is the old list of names, and `view.tools.length` now counts plugins rather than tools.
2. Replace a per-tool description with the plugin's own: resolve `group.meta?.title` and `group.meta?.description` in the reader's locale (a Client does this with `ctx.locale.resolveText`), and fall back to `group.plugin` when the package declares no title.
3. Replace the type name `ToolAvailabilityView` with `ToolPluginView` in any import from `@lyness/lyn-api-agent-capabilities-controller/types`.
4. A consumer that needs who registered a tool on the Host reads `ctx.tools.registered()` instead of comparing names.
5. Confirm it: `pnpm run test -- packages/api/agent-capabilities-controller` passes, and the composition case there asserts a package's own title reaching the reply.
