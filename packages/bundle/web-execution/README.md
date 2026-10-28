---
description: "The Web execution plane as its own bundle: the execution bundle's host-plane tool rows move behind per-session presets."
kind: "package-bundle"
---

# @deepseek-ai/dsh-web-execution

English | [中文](README.zh.md)

## Summary

`dsh-web-execution` disables the host-plane shell, filesystem, workflow, and ralph rows the execution bundle inserts, because the Web profile's presets re-add them per session, keyed by agent. It is its own bundle because the move needs both halves: a profile with the Web surface and no execution bundle has neither the rows nor the presets, and a patch naming rows that are not there reports one absent entry per row at every boot.

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

A profile selects it after both halves:

```yaml
bundles:
  - '@deepseek-ai/dsh-module-execution'
  - '@deepseek-ai/dsh-web-app'
  - '@deepseek-ai/dsh-web-execution'
```

The shipped `web` and `enterprise` templates do exactly that. The `hosted` template selects no execution bundle, so it does not select this one either.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**A patch layer cannot say "disable this if it exists".** Naming an absent row is reported rather than skipped, which is the right default — a typo in an id would otherwise be silent. So rows that only make sense when two bundles are both selected are selected with both, instead of teaching the composer to ignore what it cannot find.

**Disabling rather than deleting.** The base composition is shared, and a row deleted by a surface overlay would silently reappear the day someone reorders the layers.

**`shell-env` stays on the host plane.** The Web app injects it to publish `DSH_WEB_URL` and `DSH_WEB_MODE`, and a row that injects a service resolves before any session exists, so there is no agent to key it by. Behind a preset realm those variables would never reach the model's shell at all.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-module-execution`](../module-execution/README.md) — the rows this bundle moves.
- [`dsh-web-app`](../web-app/README.md) — the presets that re-add them per session.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through composition: the same tools reach the model, mounted by the preset its session selected rather than by the host plane, so their schemas and results are unchanged.

#### KV Cache effect

No request prefix changes, because the rows this bundle disables contribute no instructions of their own.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Selected by hand, not derived** — nothing checks that a profile with both halves also selects this bundle; one that forgets it runs the shell and filesystem tools on the host plane, which is the shape this bundle exists to prevent.

**Runtime invariant:** No companion is published. A bundle contributes composition rows; the relations worth asserting belong to the packages those rows mount.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

These rows lived in `dsh-web-app` until the hosted template — Web surface, no execution bundle — made them name seven rows that were not there, once per boot.

</details>
