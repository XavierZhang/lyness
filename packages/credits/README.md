---
description: "The credits group map: the allowance a hosted deployment meters, for users and maintainers navigating the group."
kind: "package-group"
---

# credits/ — The allowance a hosted deployment meters

English | [中文](README.zh.md)

## Summary

The credits group meters the free allowance a hosted deployment gives each person: what was granted, what was spent, what remains, and the refusal when nothing does. A balance is a ledger rather than a counter, because a refusal a customer cannot account for is a support case. This group exists only on the hosted shape — an enterprise installation mounts none of it, so credits are absent there rather than disabled. This page maps the group; the package README owns the per-package contract.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`credits/`](credits/README.md) | The ledger seam, its reset clock, and the stored provider that grants each period's allowance on first use | `ctx.credits` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Multi-tenancy subsystem](../../docs/subsystems/multi-tenancy.md) — the tenants and people a balance belongs to.
- [The model is a deployment decision](../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.md) — why credits exist on one shape only, and why money and credits are separate boundaries.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
