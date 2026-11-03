---
description: "The what-you-may-use section in Settings: a reader's models, connections, skills and tools."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-capabilities

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-capabilities` is the personal plane's read-only entry: four groups — models, connections, skills and tools — listing what this reader's conversations actually have, each row naming whether the deployment or the agent preset made it available, and one closing line saying none of it is theirs to change. It is the one answer to the question the Models, Plugins, Agent-presets and Connections pages otherwise answer with a refusal notice.

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

The Web bundle mounts it beside the namespace it reads:

```yaml
- id: agent-capabilities-controller
  name: '@lyness/lyn-api-agent-capabilities-controller'
- id: ui-settings-capabilities
  name: '@lyness/lyn-client-ui-settings-capabilities'
```

Nothing else needs configuring. The section registers last in the personal plane, after the entries a person does control.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Read-only on purpose.** In this product those four things are composed by a deployment, so a control here would promise what the next call refuses. Naming the decider instead is the honest version of the same page, and it costs no new authority.

**Two namespaces, one page.** Models come from `session.modelCatalog`, which already answers them for the model selector; the rest from `agentCapabilities`. Showing models from a second source would invite the two answers to drift.

**A broken model catalogue does not take the page down.** Only the capability read decides whether the page has an answer: a deployment whose provider list is failing still has tools and skills worth reading, and the models are left out with a line saying so rather than shown as none.

**An absent group and an empty one read differently.** "This deployment mounts no skill registry" and "no skill is discovered" are separate lines, because a reader deciding what they may use needs to know which of the two they are looking at.

**The read starts when the section opens.** A person who never opens this costs the deployment no request, and opening it twice costs one.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-agent-capabilities-controller`](../../api/agent-capabilities-controller/README.md) — the namespace this page reads.
- [`lyn-api-session-controller`](../../api/session-controller/README.md) — where the model catalogue comes from.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — where the two section-plane slots are declared.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it lists what the model-facing registries already hold, for a person to read.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **It describes the default preset, not the open conversation** — a reader who switched presets in a session sees what the deployment's default has.
- **No link from a row to its decider** — a row says "this deployment" or "your agent preset" in words; it does not open the page an administrator would change it on, because a member may not reach those pages.
- **A connection shows a count** — the server's own tool names are not listed, so a reader cannot audit what it can do from here.
- **Nothing refreshes while the panel is open** — the read happens once per opening, so a composition changed underneath shows on the next open.

**Runtime invariant:** every row comes from a read performed for this opening; the page keeps no catalogue of its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Models are listed per provider with a count rather than per model: the per-model list is the model selector's job, and repeating it here would make this page the second place a model name has to be right.

</details>
