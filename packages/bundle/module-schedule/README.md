---
description: "The scheduled follow-ups module as its own bundle, for deployments selecting it and maintainers upgrading it apart from the product."
kind: "package-bundle"
---

# @lyness/lyn-module-schedule

English | [中文](README.zh.md)

## Summary

This bundle is the scheduled follow-ups default module: the Host [Schedule service](../../schedule/schedule/README.md) and its [browser catalog](../../client/ui-schedule/README.md), as one unit a profile selects. Packaging the module separately is what lets the platform ship a fix for it without releasing the whole product, and what makes a customer's replacement and the platform's own version two bundles in one ordered list. Both rows keep the `disabled: true` they had in the web patch: this bundle moves the module, it does not switch it on.

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

The `web` profile template selects it, so a new profile has it. A profile created before this bundle existed is normalized to the current template on its next start, because its previous exact bundle tuple is recorded as installation-owned — the capability is not lost by the repackaging.

Switch the rows on from the **Plugins** page, or override them in a later patch layer:

```yaml
- id: schedule
  disabled: false
- id: ui-schedule
  disabled: false
```

Enabling the service adds four `schedule_*` tools to every agent's catalog on that profile, which changes the reusable request prefix. That is why this bundle ships them off: moving a module and changing what the model sees are separate decisions.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

The patch inserts the two rows the web patch used to carry. Their ids are unchanged, so a profile patch layer that already overrides `schedule` or `ui-schedule` keeps working: a module moving between bundles does not move its rows' addresses.

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The module's two rows |
| [`locale/en.json`](locale/en.json) | Display metadata the Plugins page reads |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-schedule`](../../schedule/schedule/README.md) — the Host service, its task store, and delivery.
- [`lyn-client-ui-schedule`](../../client/ui-schedule/README.md) — the browser catalog.
- [Default modules and the two views](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.md) — why each default module is its own bundle.

-----

<a id="model-experience"></a>
## Model Experience

None, as this bundle contributes only composition rows; the Schedule service owns every prompt, tool, and session event, and contributes them only once its row is switched on.

#### KV Cache effect

No model request prefix changes while the rows stay off. Switching the service on adds its tools to the catalog, which changes the prefix for every session on that profile.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **It ships switched off** — selecting the bundle makes the module available, not active. A deployment that wants scheduled follow-ups overrides both rows.
- **Migration covers one previous tuple** — a profile whose bundle list was edited by hand is left alone, by design, so a hand-edited profile adds this bundle by hand too.
- **Only the `web` template selects it** — a custom profile adds it to its own `lyn.profile.bundles`.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the Schedule service publishes its own invariant.

-----

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
