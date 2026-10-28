# Agent Note: Regenerating the rebrand across an upstream sync

Status: implemented

English | [中文](2026-09-12-regenerating-the-rebrand-across-an-upstream-sync.zh.md)

## Problem

The first upstream sync after the rename spanned 2,151 commits, from 0.1.2-alpha.1 to 0.1.5-rc.1. Upstream changed 8,274 files including 806 renames; the fork had changed 6,015, nearly all of them rename output. A line-level merge of two independent renames over the same tree produces conflicts in the thousands and duplicate directories wherever both sides moved a path.

The `--reverse` direction of the codemod cannot serve as a way out. The rules are not injective: three sources map onto the same scope, and the rules that rewrite escaped regular expressions would insert `(?:-|$)` into source as literal text.

## Decision

**Do not merge the rename. Regenerate it.**

The real fork delta was measured rather than assumed: applying the codemod to the merge-base tree and diffing against the fork branch left 27 files, of which 20 are regenerable (documentation catalogs, notices, lockfile, snapshots). Five files carry changes that no generator produces.

The sync therefore takes upstream's tree whole and rebuilds the fork on top:

1. `git merge -s ours --no-commit` records both parents, so the next sync computes the right merge base.
2. `git read-tree -u --reset upstream/master` replaces index and working tree with upstream's.
3. Fork-only files return from a saved copy; the five patches are reapplied.
4. `rebrand --apply` regenerates every rename.

This is only available because the codemod is replayable and idempotent. That property, not the rename itself, is what keeps the fork able to follow upstream.

## Alternatives considered

**Merge line by line.** Upstream changed 8,274 files including 806 renames while the fork had renamed 86 paths of its own. Git's rename detection declines at that size, so both sides' moves land as adds and deletes and every renamed directory appears twice. The conflict count is in the thousands and none of it is a decision anyone needs to make: the rename is derivable.

**Reverse the rename, merge, replay it.** `--reverse` exists for inspection, and the fork branch is small enough that the merge would then be trivial. It cannot be trusted for this: several rules share a target, so the reverse direction has to guess which source a name came from, and the rules that rewrite escaped regular expressions would put `(?:-|$)` into source files as literal text. A merge built on a lossy inverse hides its damage inside 6,000 files.

**Resolve conflicts with `-X theirs`.** One command, and the codemod normalizes whatever branding survives. It also silently drops every fork change that lands in a conflicting hunk, which is exactly where the fork's few real changes live — the telemetry defaults sit in a block upstream rewrote this cycle. Silent loss of the changes the fork exists for is the worst available failure.

**Branch fresh from upstream and reapply the fork.** Produces the same tree with less ceremony. It also produces a commit with one parent, so the next sync computes its merge base against the fork's old history and rediscovers the whole divergence. The ancestry is the part worth keeping.

## Consequences

Four defects in the codemod surfaced, each of which had been silently wrong since the first run.

**`scoped-directory-fragment` never matched.** It was ordered after `scope-bare`, which rewrites the scope fragment on its own; by the time the rule ran, its source text no longer existed. A path built as `join(modules, '@scope', 'product-name')` therefore kept the product segment the manifest beside it had dropped, naming a package that does not exist. It is now ordered ahead of every scope rule. A rule reporting zero matches is a defect to investigate, not a rule with nothing to do.

**Binary detection rejected two source files.** A NUL byte in the first block is what `git diff` uses, and two test fixtures embed a real NUL in a string literal. Both froze at the upstream name, one of them importing a package that no longer exists. Detection now asks whether the whole file decodes as UTF-8, which is exactly the condition under which rewriting round-trips losslessly. The same assumption had reserved NUL as the archived-reference placeholder; the rule now applies to the segments between references, reserving no character at all.

**The note recording the rename was rewritten by it.** A document whose subject is the rename must quote the upstream spelling, so the codemod turned every rule it documented into `X becomes X`. Documents of that kind — the ledger, the requirements, the codemod, and now this record — are protected.

Dropping the product segment from package names keeps costing gates. Upstream separates its own packages from rescoped vendored ones by that segment; `@lyness/<name>` cannot. This sync brought three more name-prefix checks that need excluding by hand, and one of them had failed open — a prefix built by template produced a string no package matches, so the check passed while verifying nothing. Sorted fixtures also reorder, because the new names sort differently from the old.

Three tests fail on this host. All three are new upstream code, and all three fail identically on a pristine upstream checkout, so they belong to upstream and this machine, not to the sync.
