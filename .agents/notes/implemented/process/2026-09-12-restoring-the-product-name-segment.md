# Agent Note: Restoring the product-name segment in package names

Status: implemented

English | [中文](2026-09-12-restoring-the-product-name-segment.zh.md)

## Problem

The rename first published harness packages as `@lyness/<name>`, dropping the product segment upstream carries. Upstream uses that segment as the only thing separating its own packages from the framework it vendors and rescopes into the same scope: `@deepseek-ai/dsh-agent` is a harness package, `@deepseek-ai/cordis` is not. Every gate that classifies a package by name reads that difference.

Without the segment the scope classifies nothing, and it fails in two directions. A widened prefix pulls the vendored and Landlock families into the release family, so the version-coherence and MIT-license gates reject packages that legitimately track their own upstream lines. A prefix composed from a constant narrows to nothing — `` `${LYNESS_PACKAGE}-` `` became `@lyness/lyn-`, which no package matched, so the npm install-layout gate passed while verifying nothing. That second direction is the dangerous one: it reports success.

Six gates needed excluding by hand, three of them arriving with a single upstream sync. The cost is unbounded, because upstream keeps adding gates of that kind and each one lands green or red at random depending on which direction its prefix breaks.

## Decision

Harness packages carry the segment: `@lyness/lyn-<name>`. Rescoped vendored packages keep `@lyness/<name>`. The structure is upstream's, renamed.

`rebrand.ts` expresses this in one rule (`pkg-scope`: `@deepseek-ai/dsh-` → `@lyness/lyn-`), and the two postconditions that read `@lyness/lyn-llm-deepseek` beside `@lyness/cordis` assert the distinction survives each replay.

## Alternatives considered

**Keep dropping the segment and exclude each gate by hand.** No package name changes, and the six exclusions already existed. It accepts an unbounded cost that grows with upstream's gate count, and it cannot be discharged by review: a gate whose prefix narrows to nothing passes, so the failure mode is invisible precisely when it matters.

**Classify by location everywhere instead of by name.** `vendor/`, `native/`, and `website/` are honest signals, and the license gate uses exactly that. It requires editing every upstream gate that classifies by name, forever, and location is not available where the classification happens at runtime against an installed tree rather than a workspace.

**Give vendored packages a separate scope.** `@lyness-vendor/cordis` restores the distinction without lengthening harness names. It diverges further from upstream than the rename needs to: two scopes where upstream has one means the vendoring procedure, the rescope codemod, and every manifest that names a peer dependency stop matching upstream's shape, and each future sync has to reconcile that too.

## Consequences

Three codemod rules existed only to paper over the dropped segment and are deleted: the display-prefix strip, the split-fragment path rule, and the bare escaped-scope rule. A path written as `join(modules, '@scope', 'dsh-desktop-host')` now renames correctly through the ordinary scope and token rules, which is what the deleted special case was failing to do. Eighteen rules remain where there were twenty-one.

All six gate exclusions revert. Upstream's checks run verbatim, and `hygiene` passes with no fork edit to any of them. The desktop package-set fixtures revert too: `lyn` sorts before `lyn-base` and `lyn-desktop-host` exactly as `dsh` did.

Sorted output still reorders where the token rename reaches inside a name — `subagent_lyn_sdk` sorts after `subagent_fork` where `subagent_dsh_sdk` sorted before it. The tool-schema expectation, one inline snapshot's key order, and two Chinese-side documentation orderings are corrected by hand after each replay, and the post-replay checklist in the fork ledger names them.

Package names are longer. `@lyness/lyn-agent` reads redundantly, and that redundancy is what the gates depend on.
