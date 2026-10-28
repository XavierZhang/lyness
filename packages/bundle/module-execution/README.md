---
description: "The execution module bundle, for deployments choosing which machine an agent works on."
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-execution

English | [中文](README.zh.md)

## Summary

`dsh-module-execution` is the plane that touches a machine: the sandboxed filesystem provider, the subprocess and sandbox providers, the shell and file tools, and the code and workflow runtimes. Every shipped profile that works on the machine it runs on selects it, and it answers one question for a deployment — which machine does this agent work on — instead of a dozen separate ones. A profile that omits it has no `ctx.fs`, `ctx.shell`, `ctx.subprocess`, `ctx.sandbox` or `ctx.ptcRuntime`, so the tools that inject them never activate.

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

It is a bundle, not a plugin: a profile selects it in `dsh.profile.bundles`, after `@deepseek-ai/dsh-base`.

```json
{ "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "@deepseek-ai/dsh-module-execution"] } } }
```

The `web`, `enterprise`, `headless`, `acp` and `sdk` templates all select it. `sdk-minimal` does not: it is a standalone bundle carrying its own execution rows.

| Row | Provides |
|---|---|
| `subprocess` · `sandbox` · `sandbox-policy` | `ctx.subprocess`, `ctx.sandbox`, `ctx.sandboxPolicy` |
| `bash-sandbox` · `pwsh-sandbox` · `shell-env` | `ctx.shell` on the platform that has it, and its environment |
| `fs-sandbox` · `fs-observation-policy` | `ctx.fs`, confined by the sandbox policy |
| `tool-bash` · `tool-pwsh` · `tool-fs` · `tool-fs-search` | The tools a model calls to read and change a machine |
| `ptc-runtime` · `workflow-ptc` · `tool-workflow` · `tool-ralph` | `ctx.ptcRuntime` and the workflow engine built on it |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It left `dsh-base` so that a runtime can execute nothing at all.** A hosted deployment serving several customers from one process has no boundary between them: credits, roles and the model policy constrain the model request and nothing else, while a confined command still runs on the host, as the host's user, with the host's network. Until an organization gets a process, the only boundary that holds is the absence of these rows — and absence is the one form of "cannot execute" that a later patch layer cannot switch back on.

**Absent rather than disabled.** A disabled row is a row an overlay re-enables; an unselected bundle is not in the composition at all. That difference is the whole point of making this a bundle rather than a `disabled: true` block in `dsh-base`.

**`approval` and `permission-presets` stayed behind.** They are the approval vocabulary every tool reads, not execution rows. A profile without this bundle still has them, and its permission presets still name sandbox modes — which nothing applies, because there is no sandbox.

**Row order does not matter.** `fs-sandbox` injects `sandboxPolicy` and `ptc-runtime` injects four services; Cordis activates a plugin when its injected services appear, so appending these rows after the base layer resolves exactly as mounting them inside it did.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Leaving the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why a composition that executes nothing has to be possible.
- [Agent isolation and teams](../../../.agents/notes/proposed/architecture/2026-10-08-agent-isolation-and-teams.md) — the boundary this bundle's absence stands in for.
- [`dsh-base`](../base/README.md) — the layer it left.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: `dsh-tool-bash`, `dsh-tool-pwsh`, `dsh-tool-fs`, `dsh-tool-fs-search`, `dsh-tool-workflow` and `dsh-tool-ralph` own their schemas and results, and this bundle decides only whether a profile carries them. The assembled schema text is sorted by tool name, so moving these rows out of `dsh-base` changed no model-visible text for a profile that still selects them.

#### KV Cache effect

None for a profile that selects it: the same tools reach the same assembly in the same order. A profile that omits it has a shorter tool section, which changes the prefix once at composition rather than per request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Permission presets dangle without it** — a profile that omits this bundle still offers `read-only`, `workspace-write` and `danger-full-access`, and none of them does anything, because the sandbox they name is absent.
- **It is all or nothing** — a deployment wanting files but not shells selects the rows itself rather than this bundle; the bundle exists for the one question it answers, not as a menu.
- **No remote provider yet** — the providers here are local. Reaching a machine that is not the one running the Host is `fs-ssh` and `subprocess-ssh` today, and a desktop executor later.

**Runtime invariant:** No companion is published. A bundle is a patch document; it holds no state and owns no relation that two observers could read differently.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Every profile template that selected `dsh-base` before this extraction has its pre-extraction bundle tuple recorded in `INSTALLATION_OWNED_PROFILE_TUPLES`, so an installed profile is rewritten to the current list instead of silently losing its tools.

</details>
