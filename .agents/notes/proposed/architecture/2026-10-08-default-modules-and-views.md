# Agent Note: Which modules a customer gets by default, and the two views over them

Status: proposed

English | [中文](2026-10-08-default-modules-and-views.zh.md)

## Problem

"Everything is a plugin" is the right principle and a poor default. It says what the runtime is made of; it does not say what a customer who signs up actually gets, and in this tree the answer is "less than is built".

Capabilities exist, are tested, and no shipped profile mounts them. [`tool-lsp`](../../../../packages/lsp/README.md), [`computer-use`](../../../../packages/computer-use/README.md), [`browser-use`](../../../../packages/browser-use/README.md), [`hooks-claude-code` and `hooks-codex`](../../../../packages/hooks/README.md), and the agent-facing [`tool-terminal`](../../../../packages/terminal/README.md) appear only in snapshot compositions. [`webhook`](../../../../packages/webhook/README.md) appears only in a CLI example and a test fixture. Others are mounted in exactly one profile: `schedule` and [`workspace-changes`](../../../../packages/deliverables/README.md) in `web-app`, and [`tool-cordis`](../../../../packages/extensions/README.md) only inside the Creator preset. A customer reaching any of these has to author a patch layer, which is a thing a developer does and a thing a customer never will.

So the composition is the product's feature list, and nobody decided it as one. Each row was added where it was needed and left where it landed.

The packaging has the same shape, and it costs the platform its own upgrade path. A default capability is a **row inside a shipped patch**, not a package a deployment selects, so the only way the platform ships a fix to one is a new release of the whole product. [`lyn-plugin-manager`](../../../../packages/boot/plugin-manager/README.md) can already install, pin, version-check and revert a bundle from a registry, a Git host, a tarball or a path, and the launcher's `OPTIONAL_BUNDLES` already ships bundles switched off and unremovable — so the machinery for an independently upgradable module exists and the default modules are the one thing that does not use it.

Two consequences follow for a hosted product. A customer cannot tell what the product does, because the answer differs per profile and is written in YAML. And a customer who replaces a module with a plugin has no way back: `lyn-base` disabling a row and a profile never mounting it look identical from the outside, so "return to the default" is not an operation that exists.

There is also no place to put the modules a hosted product needs and this tree has never had — a knowledge base, a catalog of the customer's own systems, and a record of who did what — and each would otherwise arrive as one more row in whichever profile the author happened to be editing.

## Proposal

Name a set of default modules, ship all of them in every profile that serves people, let a plugin replace any of them, and keep a way back.

### Twelve default modules

Nine already exist and are promoted to defaults: the agent terminal, language servers, computer use, browser use, webhook ingress, external harness hooks, scheduled follow-ups, turn deliverables, and runtime self-modification. Promotion means a shipped profile mounts them, not that new code is written: the work is composition, settings surface, and the UI each one needs.

Three are new and land in the same batch, because a hosted product without them is not competitive and adding them later would repeat the mistake this note is fixing:

- **Knowledge and retrieval** — a customer's documents, indexed, reachable as a tool. The thing every customer asks for first and the one capability with no counterpart in the tree today.
- **Connector catalog** — the customer's own systems, registered as MCP servers and administered as a list rather than as configuration. The transport exists; what is missing is a surface where an administrator adds one and a member sees what is connected.
- **Audit and usage** — what was done, by which member, at what cost. [Isolation and teams](2026-10-08-agent-isolation-and-teams.md) decides that usage is attributed per member; this is where that record is read.

Runtime self-modification is the one module whose availability is not universal: it is the Creator-mode capability, and [plugin trust](2026-10-08-plugin-compatibility-and-trust.md) governs where it may run. It is a default module in the sense that the platform ships and maintains it, not in the sense that every deployment offers it.

### Default-on, subject to plan and deployment

Every core capability is enabled unless the customer's plan excludes it or the deployment cannot run it safely. Those two conditions are the only reasons a module is off, and both are stated rather than expressed as an absent row. A capability that is off because nobody mounted it is the defect; a capability that is off because the plan does not include it is a product decision with a surface that can say so.

### Each default module is its own shipped bundle

A default module is a bundle the platform publishes, selected out of the box and not removable — the shape `OPTIONAL_BUNDLES` already has, minus the switched-off part. It is not a row inside a profile patch.

This is what gives the platform the same upgrade path it gives a customer. A module ships, is fixed, and is upgraded through [`lyn-plugin-manager`](../../../../packages/boot/plugin-manager/README.md), under the same registry plan, the same LYN peer-version check before anything downloads, and the same rollback of manifest and lockfile on failure. The platform stops needing a release of the whole product to correct one module, and a customer on a slow upgrade cadence can still receive one.

It also makes "replace" and "revert" one mechanism instead of two. A customer's replacement and the platform's own version are both bundles competing for the same rows, resolved by the ordered bundle list that already decides this.

A module that is one package stays one bundle; a module that spans several packages ships one bundle that mounts them, so the unit a customer selects is the module and not its parts.

### A plugin may replace a module, and there is a way back

Each default module is one or more plugins the platform publishes and maintains. A customer may install a plugin that replaces one, and may return to the platform's version afterwards.

Returning restores the version pinned by the release the deployment is running, not whatever was most recently published — otherwise "revert" would be an upgrade with another name, and a customer reverting to escape a problem would be stepping onto a version nobody tested against their data. Data the replacement wrote is retained and marked as having been written by it, because a replacement's records are the customer's records, and silently discarding them is worse than keeping records the default module may not fully understand.

### Two views over the same runtime

The product presents the same composition twice, for two different people.

The **business view** is for the person doing work: conversations, knowledge, connectors, usage, settings. It names capabilities in the customer's terms and never shows a plugin id, a profile, or a patch layer.

The **development view** is for the person extending the product: the composition as rows, the patch layers that produced it, the installed plugins and what they replace, and the authoring path. It is reached deliberately and is not where a new user starts.

The split is not two applications. The business view is the default surface; the development view is the existing settings-and-composition surface, named and reached as its own thing rather than mixed into general settings.

### UI organisation borrowed rather than invented

The arrangement follows what mainstream agent harnesses converged on, because customers arrive already knowing it: a left rail for workspaces and conversations, a center column for the conversation, and a right panel for the work's context — files, terminal, browser, preview — switched by tab. This tree already has those pieces ([`ui-sidebar`, `ui-sidebar-right`, and the files, terminal, browser and preview panels](../../../../packages/client/ui-sidebar-right/README.md)); what is missing is that they are arranged per profile rather than as the product's layout.

The default UI is lyness's own. A tenant that customised its brand, or a private deployment that completed setup, replaces the identity inside that layout — the brand, not the arrangement, per [per-tenant brand](2026-10-07-per-tenant-brand.md).

### Plugin authoring follows the existing cookbook

A plugin that replaces a default module is an ordinary package in this tree, and the path is already written: [adding a package](../../../../docs/cookbook/adding-a-package.md), [a tool](../../../../docs/cookbook/adding-a-tool.md), [a settings card](../../../../docs/cookbook/adding-a-settings-card.md), [a remote API](../../../../docs/cookbook/adding-a-remote-api.md). What the authoring guide adds is what is specific to replacement: which service a module provides, what a replacement must provide to be accepted in its place, and what happens to the data it wrote when the customer returns to the default.

## Alternatives considered

**Keep the composition as the feature list.** No new concept, and the profiles already work. Rejected: the feature list is then written in YAML per profile, and the gap between what is built and what a customer can reach stays invisible until a customer asks for something that exists.

**Keep default modules as rows in the shipped patches.** It is today's packaging and costs nothing to keep. Rejected: it leaves the platform with no way to ship a module fix except a release of the whole product, and it makes a customer's replacement and the platform's own version two different mechanisms rather than two bundles in one ordered list.

**Mount everything in `lyn-base`.** The simplest promotion, and one place to look. Rejected: `lyn-base` is shared by headless, SDK, ACP and app profiles, and a webhook ingress or a right-panel browser in a headless SDK run is weight nobody asked for. Promotion belongs in the profiles that serve people.

**Add the three new modules later.** The nine promotions are cheap; the new modules are real work. Rejected: a hosted product without knowledge, connectors, or an audit record is not sellable, and deferring them would park them in whichever profile their author was editing — the exact failure this note exists to fix.

**Let a revert pull the latest published default.** Fewer versions to track. Rejected: it makes revert an upgrade, so a customer reverting to escape a problem lands on a version nobody tested against their data.

**Discard a replacement's data on revert.** Cleaner, and the default module never meets records it does not understand. Rejected: those records are the customer's, and losing them is a worse outcome than holding data the default module reads partially.

**One view with a developer toggle.** Less surface to build. Rejected: a toggle inside one view keeps plugin ids and patch layers one click from a business user, and the two audiences want different defaults, not the same page with rows hidden.

**Design the layout for this product.** It would fit the capabilities exactly. Rejected: customers arrive with expectations set by other harnesses, and spending novelty on where the file tree lives buys nothing.

## Acceptance criteria

- The twelve default modules are named in one place, and every profile that serves people mounts all of them that its deployment supports.
- A module is off only because the plan excludes it or the deployment cannot run it; the surface states which, and no module is off merely because no row mounts it.
- Each default module is a bundle selected out of the box and not removable, and no default module is a row inside a profile patch.
- The platform can upgrade one default module through the plugin manager, without a release of the whole product, and that upgrade passes the same version check as any other bundle.
- A customer can replace a default module with a plugin and return to the platform's version, and the return restores the version pinned by the running release.
- Data written by a replacement survives a return to the default and is marked as that replacement's.
- The business view shows no plugin id, profile name, or patch layer; the development view is reached as its own surface rather than through general settings.
- The layout is the product's, not the profile's: the rail, conversation column and right panel are the same across profiles that serve people.
- A tenant brand or a completed private-deployment setup changes the identity inside the layout and not the layout.
- The authoring guide states, for each default module, the service a replacement must provide and what happens to its data on revert.

## Risks

**Twelve modules default-on is a large surface to keep working.** Every one needs settings, UI, documentation and tests, and a module that ships half-finished is worse than one that is honestly absent. Sequencing within the batch matters even though the batch is decided.

**The three new modules are the schedule risk.** Knowledge and retrieval in particular is a product in itself — ingestion, indexing, permissions, freshness — and calling it one module of twelve understates it.

**Twelve bundles is twelve published packages to version.** Each one gains its own release, its own peer range against the runtime, and its own compatibility surface. A module upgraded independently is a module that can be a version the rest of the composition was never tested against, which is the cost of not needing a whole-product release.

**Revert is only as good as the service definitions.** A replacement is accepted in a module's place because it provides that module's service. Where a service definition is loose, a replacement can satisfy it and still behave differently, and revert will not undo what the difference wrote.

**Two views can drift.** A capability added to one and not the other produces a product whose two surfaces disagree about what exists. Whichever view is easier to edit will lead, and it will be the development view.

**Default-on enlarges what a prompt can reach.** Computer use, browser use and a terminal in every profile that serves people means the agent's reach is wider by default than it is today. The containment in [isolation and teams](2026-10-08-agent-isolation-and-teams.md) is what makes this acceptable, so these promotions depend on it rather than standing alone.
