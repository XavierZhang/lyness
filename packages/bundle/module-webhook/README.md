---
description: "The webhook ingress module as its own bundle, shipped inert because an enabled adapter is authenticated public HTTP that creates Sessions."
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-webhook

English | [中文](README.zh.md)

## Summary

This bundle is the webhook ingress default module: an external event becoming a new agent Session. It carries the Host rule runtime and the GitHub adapter. Both rows ship **disabled**, which is structural and a security decision at once — the adapter's four required fields include a credential reference, and an enabled adapter is authenticated public HTTP ingress that creates root Sessions.

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

Selecting the bundle does not switch the module on, and enabling the two rows is not enough either. Three things are needed:

```yaml
- id: webhook-runtime
  disabled: false
- id: webhook-github
  disabled: false
  config:
    source: github
    path: /webhook/github
    secretEnv: GITHUB_WEBHOOK_SECRET
    maxBodyBytes: 1048576
```

Then a rule. Rules are plugins a deployment authors: they inject `webhookRuntime` and yield the disposer `register()` returns. The runtime ships none, so a configured route with no rule accepts deliveries and starts nothing. [The GitHub review guide](../../../docs/user/guide/github-review.md) walks a rule module, a dedicated ingress port, secret setup, and Workspace routing end to end.

Every adapter field is required, so an enabled adapter row with no config fails loudly at load rather than opening an unverified route.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

| Row | Module | Role |
|---|---|---|
| `webhook-runtime` | `@deepseek-ai/dsh-webhook` | The Host rule registry and the one built-in action, creating a root Session in a Web Workspace |
| `webhook-github` | `@deepseek-ai/dsh-webhook-github` | One exact HTTP route that bounds and verifies GitHub's raw body, then dispatches |

The runtime loads on the Web Host plane after Agents, model defaults, agent presets, permission presets, titles, and the Workspace registry, which is the order this bundle's position in the template produces.

The security boundary is worth stating precisely, because the shared secret is easy to mistake for one. The secret proves the delivery came from the configured sender; it says nothing about which tenant the resulting Session belongs to. Route and Workspace routing carry that decision, which is the adapter-authenticates and plane-authorizes split the inbound-interfaces note describes. A deployment serving more than one tenant decides it deliberately rather than inheriting it from a default.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's two rows and why each ships off |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`webhook/`](../../webhook/README.md) — the rule interface, the Session request, and the GitHub adapter.
- [GitHub review guide](../../../docs/user/guide/github-review.md) — a worked rule, port, secret, and routing setup.
- [Inbound interfaces and the Session plane](../../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.md) — why adapters authenticate and the plane authorizes.
- [`dsh-module-lsp`](../module-lsp/README.md) — the other module whose inertness is structural.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it inserts: a matching rule owns the initial prompt its Session begins with, and the generic runtime adds no framing of its own.

#### KV Cache effect

No model request changes while the rows stay disabled, which is their shipped state, so selecting this bundle leaves every existing prefix byte-identical. An enabled rule's prompt begins a new Session, so it establishes that Session's reusable prefix rather than invalidating anything; a rule that incorporates external text owns labelling it untrusted, as the shipped GitHub example does for selected pull-request fields.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **It ships inert and cannot ship otherwise** — the secret, route, and source are a deployment's to supply, and no default would be right for a public route.
- **Enabling the rows is not enough** — without a user-authored rule the route accepts deliveries and starts nothing. That is the runtime's design, not a gap in this bundle.
- **The secret authenticates the sender, not the tenant** — on a shared host, route and Workspace routing are the authorization boundary and need deciding per deployment.
- **Only the GitHub adapter is here** — another provider needs its own adapter package; the runtime's interface is provider-neutral.
- **Migration covers the recorded previous tuples** — a profile whose bundle list was edited by hand is left alone, by design.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the runtime publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This is the first default module that is inert for two independent reasons at once, and both must survive edits: required configuration with no sensible default, and a public route whose authorization is a per-deployment decision. Removing either reason does not make the other go away.

</details>
