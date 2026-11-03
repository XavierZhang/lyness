---
description: "What one reader's agents may use, and who decided each part of it."
kind: "package-reference"
---

# @lyness/lyn-api-agent-capabilities-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-agent-capabilities-controller` owns the `agentCapabilities` Remote namespace: one read answering which tools, MCP connections and skills a reader's conversations actually have, each naming whether the deployment or the agent preset made it available. Every answer is projected from the registries an agent itself reads, at the moment it is asked, so the namespace keeps no list of its own and cannot disagree with what the agents have.

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

Mount it where the tool registry is; the preset and skill registries are optional:

```yaml
- id: agent-capabilities-controller
  name: '@lyness/lyn-api-agent-capabilities-controller'
```

`describe()` answers the tools, connections and skills available, and names the preset it read. Models are not here: `session.modelCatalog` already answers which models this deployment routes, and a surface shows them from there.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It keeps no list.** Every call reads `ctx.tools.definitions()` and `ctx.skills.list()` again. A list kept here would be a second answer about capabilities and would disagree with the agents the first time a composition changed.

**The preset's own scope is acquired for the read.** `agentPresets.acquireScope()` hands back a revision lease, so what is reported is the view an agent of that preset would see rather than the deployment's bare registrations. The lease is released even when the read throws, because it is a retain that holds the preset generation from collection.

**Who gave a capability is computed, not stored.** A tool registration carries no registrant, so the answer comes from comparing the preset's view with the deployment-wide one: present in both means the deployment, present only in the scope means the preset.

**An MCP server is one connection, not four tools.** `lyn-mcp-client` names each tool `mcp__<server>__<raw>`, so the server is read out of the name and its tools are counted rather than listed; a reader deciding whether they may reach a system cares about the system.

**A missing registry is reported as missing.** A deployment that mounts no skill registry gets no `skills` member at all, which a surface reads as "this installation has no skills" rather than as "it discovered none".

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-client-ui-settings-capabilities`](../../client/ui-settings-capabilities/README.md) — the page that calls this.
- [`lyn-tools`](../../core/tools/README.md) — the registry whose scoped views this projects.
- [`lyn-skill`](../../skill/skill/README.md) — the catalog whose `source` and `provider` this reports.
- [`lyn-mcp-client`](../../mcp/mcp-client/README.md) — what names a tool after its server.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it reports what the model-facing registries already hold, and each registry owns how its own contributions reach a request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Agent-scoped restrictions are not reflected** — `tools.restrict()` applies at an agent's own scope, and this read has no agent, so a tool a running conversation denied itself still appears here.
- **One preset, the default** — a reader whose conversations run a preset they selected per session sees the deployment's default rather than that one.
- **Attribution is a comparison, not a stored registrant** — a tool the deployment and a preset both register reads as the deployment's, because that is what the two views cannot tell apart.
- **A connection reports a count, not its tools** — a reader cannot see which four verbs a server offers without asking an agent.

**Runtime invariant:** no state is retained between calls; the lease acquired for a read is released before it returns.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The preset and skill registries are read with `ctx.get` rather than declared in `inject`, so a composition that mounts neither still serves the namespace with the only view it has.

</details>
