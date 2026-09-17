---
description: "The tenant package group: which tenants a deployment serves, and how one HTTP request resolves to exactly one of them."
kind: "package-group"
---

# tenant/ — tenant directory

English | [中文](README.zh.md)

## Summary

A tenant is an organization whose data, configuration, and credentials stay separate from every other tenant's. This group answers the first question multi-tenancy asks: which tenants does this deployment serve, and which one is this request for. The seam is a directory of three lookups — an immutable id, a hostname, a slug — with a composition-configured backend and an HTTP consumer that applies one deployment's resolution policy. A deployment that mounts nothing here is single-tenant, and nothing else in the harness changes.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## Packages

| Package | Role |
|---|---|
| [`tenant`](tenant/README.md) | Service Definition: the `ctx.tenants` directory and the tenant vocabulary every face shares |
| [`tenant-static`](tenant-static/README.md) | Provider: the roster an operator writes in composition config, validated at load |
| [`tenant-http`](tenant-http/README.md) | Consumer: resolves the tenant one HTTP request belongs to, and answers which it is |

<a id="related-documentation"></a>
## Related documentation

- [Multi-tenancy subsystem](../../docs/subsystems/multi-tenancy.md) — the tenant vocabulary and the resolution order, with the generated service reference.
- [brand-deployment](../host/brand-deployment/README.md) — the deployment's own brand, which is deployment-wide rather than per tenant.
- [webserver](../host/webserver/README.md) — the HTTP carrier the resolution route registers on.
- [Capability seams](../../docs/glossary.md#capability-seam) — the Definition / Provider / Consumer roles this group is split along.

<a id="dev-note"></a>
## Dev Note

None.
