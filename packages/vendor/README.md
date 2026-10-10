---
description: "The vendor group map: one package per external vendor, contributing an identity face, a channel face, or both, for users connecting a vendor and maintainers adding one."
kind: "package-group"
---

# vendor/ — External vendor integrations

English | [中文](README.zh.md)

## Summary

The vendor group holds one package per external vendor a deployment connects to. A vendor may contribute two faces: an **identity face** that signs a person in, and a **channel face** that receives its events and delivers replies. A vendor with both shares one application credential and one token-refresh path, which is why a package is per vendor rather than per face. Microsoft is the first: Entra ID is its identity face, and Teams would be its channel face on the same registration. Each package README owns its contract.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`microsoft-entra/`](microsoft-entra/README.md) | Microsoft Entra ID browser sign-in and the verified subject it establishes — the identity face of the Microsoft integration | `ctx.microsoftEntra` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Vendor integrations](../../docs/subsystems/vendor-integrations.md) — the two faces, what they share, and what a vendor package owns.
- [Inbound interfaces and the one session plane](../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.md) — the decision record, including why identity and channel live in one package.
- [Generated configuration catalog](../../docs/config-catalog.md) — every config field the group's packages accept.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
