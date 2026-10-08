# Agent Note: Upstream plugin compatibility and who may install one

Status: proposed

English | [中文](2026-10-08-plugin-compatibility-and-trust.zh.md)

## Problem

Two questions about plugins have no answer today, and they pull in opposite directions.

**An upstream plugin cannot be installed.** The rebrand renamed every package from the `@deepseek-ai/dsh-*` scope to `@lyness/lyn-*`. A plugin written for the upstream harness imports packages under the old scope and declares peer dependencies on them, and [`lyn-plugin-manager`](../../../../packages/boot/plugin-manager/README.md) judges compatibility by the LYN peers a package declares against the running LYN version. Neither the imports nor the peers resolve here, so an upstream plugin does not fail a version check — it fails to exist. Whatever the upstream ecosystem produces is unreachable from this product.

**A plugin is arbitrary code in the host process.** Installation runs a package manager, which runs install scripts, and the plugin then loads into the same process as every other row. On a developer's own machine that is the point. On shared hosted infrastructure serving many organizations, it is the ability to run arbitrary code next to other customers' conversations. The shipped product makes this reachable: of the four modes it offers — Standard, PTC, Minimal, and Creator — the last exists to let the agent write plugins and add features or UI through conversation. `lyn-base` keeps the plugin-manager tool `disabled: true`, so no agent installs anything by default, but Creator mode is exactly the switch that turns it on.

Both questions become urgent in the hosted product and in no other deployment. A private deployment is one organization on its own server; the desktop application is one person on their own machine. Only the hosted product puts several customers behind one runtime, and only there does "who may install a plugin" have a wrong answer.

## Proposal

Reach the upstream ecosystem through an alias layer, and let what a plugin may do follow from where it runs.

### The alias layer

Publish a set of packages under the upstream scope whose only content is a re-export of the lyness package that replaced it. An upstream plugin's imports and peer declarations then resolve, and it loads with no change to its source.

The layer covers only the packages a plugin actually imports — the public surface the upstream harness documents for plugin authors — not all sixty-odd packages in the tree. A gate holds the list against what the upstream surface actually exports, because the alias layer tracks a moving target: every upstream merge may add, rename, or withdraw an export, and an alias that silently stops matching is worse than one that was never published.

### Four modes, one of which is different

The product ships four modes. Three of them — Standard, PTC, and Minimal — select tools and prompts from what the composition already mounts. They change what the agent reaches, never what the runtime contains, and they carry no code into the process.

Creator mode is the exception, and the whole trust question lives there: it exists so the agent can write and install plugins. Treating all four alike is what would make the hosted product unsafe, and treating Creator as merely "more tools" is the mistake to avoid.

### Where a plugin may be installed, and by whom

- **Desktop and private deployment** — unchanged. The person who runs the server is the person who accepts the risk, and all four modes are available.
- **Hosted product, default** — an organization installs only from a catalog the platform reviewed. Creator mode is not offered, because there is nowhere safe to run what it would produce.
- **Hosted product, Creator mode purchased** — the organization gets its own runtime, and Creator mode runs there. The isolation is what is being sold; without it the feature cannot be offered at all.

### A plugin an organization wrote belongs to that organization

A plugin written inside an organization is visible only to that organization's members, and takes effect for a member only after that member installs it. Until then it is a candidate the organization holds: authored, visible, and running for nobody. One member's experiment does not change another member's agent.

An organization may later offer a plugin it wrote to other organizations, by publishing it to the marketplace. Publishing is a deliberate step with its own review, not a consequence of having written the plugin, and what the marketplace carries is reviewed on the same terms as anything else a hosted organization may install. Selling is a commercial arrangement on top of that and does not change the trust rule: a published plugin is reviewed before any other organization can reach it.

### The runtime decides, not the catalogue

Whether a plugin may be installed is checked where the installation happens, not in the page that offers it. A hosted organization without its own runtime cannot install from outside the catalog even by calling the operation directly, and the plugin-manager tool stays disabled unless the composition that enables it is one the platform placed.

## Alternatives considered

**Publish every package under both scopes.** The most complete compatibility, and no separate layer to maintain. Rejected: it doubles the published surface of sixty-odd packages, and it re-introduces the upstream brand into the product's own dependency graph, which the rebrand deliberately removed.

**Support only lyness-native plugins.** Simplest, and no moving target to track. Rejected: it gives up the upstream ecosystem, which is the main reason to stay compatible with upstream at all.

**Rewrite upstream plugins on install.** A codemod could rewrite imports as the package is installed. Rejected: it edits third-party code the author still supports, and the rewritten copy no longer matches what its author can reproduce or debug.

**Offer Creator mode on shared infrastructure with a sandbox around the plugin.** Cheaper than a runtime per organization. Rejected for now: a plugin is a Cordis row with the same reach as every other row, and confining one row inside a shared process is a much larger piece of work than giving the organization its own process. The per-tenant runtime already exists as a decision for other reasons.

**Let an authored plugin take effect for the whole organization at once.** Fewer steps for the author. Rejected: one member's experiment would change every colleague's agent, and the first bad plugin would take the organization down rather than one person.

## Acceptance criteria

- An unmodified upstream plugin that imports the aliased surface installs and loads.
- A gate fails when the alias list and the upstream surface disagree.
- Creator mode is unavailable to a hosted organization without its own runtime, enforced where the installation runs rather than by hiding the control.
- A plugin authored inside an organization is invisible to other organizations and inert for members who have not installed it.
- Publishing to the marketplace is a separate operation with its own review, and a marketplace plugin reaches another organization only after that review.
- Desktop and private deployments keep all four modes.

## Risks

**The alias layer follows someone else's decisions.** Upstream owns the surface; this product only mirrors it. Every merge is a chance for the mirror to drift, and the gate catches disagreement but cannot decide what to do about it — that stays a judgement each merge.

**A reviewed catalog is only as good as the review.** Moving the trust boundary to a review makes the review the security control. What the review checks, and who performs it, is work this note does not design.

**Per-organization runtimes change the cost model.** Creator mode becomes a product with infrastructure behind it rather than a feature flag. Pricing it below that cost would make every sale a loss.

**Marketplace plugins carry the platform's name.** A customer who installs from the marketplace will hold the platform responsible for what it does, whoever wrote it. The review, the revocation path, and what happens to organizations running a withdrawn plugin all need answers before the marketplace opens.
