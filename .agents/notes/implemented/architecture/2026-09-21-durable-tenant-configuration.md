# Agent Note: Tenant configuration a deployment saves, not edits and restarts

Status: implemented

English | [中文](2026-09-21-durable-tenant-configuration.zh.md)

## Problem

The tenant-configuration seam declared that a backend states whether it accepts saves, and the only backend shipped was read-only. Changing a tenant's models, provider grants, features, identity, or copy meant editing the deployment's patch layer and restarting, which an administration surface cannot do and an operator should not have to do for a routine change. `capability()` existed with nothing that ever answered `writable`.

## Decision

`@lyness/lyn-tenant-config-store` registers `ctx.tenantConfig` over the storage domain: one record per tenant in the `tenant_config` domain, version 1, layout `per-record`. It reports a `writable` capability, validates a save against the seam's own `validateTenantConfig` before writing it, and takes no configuration of its own — the records are the configuration.

Three rulings shape it.

**Records, not rows, and never both.** The two backends are alternatives: the seam holds one store per context, so a deployment mounts the composition-configured one or this one. Layering them would ask which wins per field, and a configuration that is half patch layer and half database is one an operator cannot diff before a deployment starts.

**`per-record`, not one document.** A deployment's tenants are individually written and individually disposable. Saving one tenant's configuration must not rewrite every other tenant's, both because a concurrent save would lose the other's write and because one corrupt document would take the whole roster down.

**Validation before the write, not at the read.** A save that breaks a rule is refused with every problem listed at once, so a form reports them together. The alternative — store it and fail later — surfaces the mistake at a provider request, far from the administrator who made it.

## Alternatives considered

**Extend the composition-configured backend to write its own patch layer.** One backend, and an operator keeps a readable file. Writing composition config from a running process makes the file both an input and an output: a save races the loader, and a hand edit and a save overwrite each other with no record of which came last.

**A dedicated SQL table rather than the storage domain.** Indexed queries over tenants, and a familiar migration story. The domain layer already owns versioning, backend routing, and read-time schema validation; a private table would re-implement all three and tie the store to one medium, when a private deployment wants JSON files and a SaaS deployment wants SQLite.

**Field-level updates.** An administration surface that edits one checkbox would write one field. The seam's rules are whole-configuration rules — a preferred model must be in the available list, a model's provider must be granted — so a field write would validate against a configuration it cannot see. Read, change, save keeps every save checkable.

**Notify consumers on save.** A surface reading a stale configuration would refresh itself. Nothing reads configuration on a hot path yet, and an event with no subscriber is a session-log obligation and a compatibility promise bought before it is needed.

## Consequences

An administration surface can now save. What it cannot do here is create or store a tenant's key: a record names a credential reference, and writing the value behind that reference is the credential store's own surface.

A consumer that read a configuration is not told when a save replaces it, and reads again to see the new one. No consumer holds one long enough for that to matter today.

The store is not mounted in any shipped profile. A profile that wants it also wants a medium and a domain route, which is a composition decision per deployment; the profiles that ship keep the read-only backend until the administration surface exists to save through this one.

`ctx.tenantConfig` needed no new generator-table entries — the seam already had them — but the package needed the Host compiler face reference, the model-experience disposition, and the seam's implementations list, all recorded in `CUSTOM.md`.
