# Agent Note: The lyness rebrand codemod

Status: implemented

English | [中文](2026-08-31-lyness-rebrand-codemod.zh.md)

## Problem

The fork publishes under its own identity, so every name the upstream product owns has to move: the npm scope, the CLI command, the home directory, the environment prefix, the display name, and the repository URL. Around 40,000 lines across 6,000 files carry one of them.

Renaming that by hand is a one-time act. Upstream keeps moving, and every sync reintroduces the upstream names in whatever it touched. A rename that cannot be replayed decays into a permanent merge cost.

Two names also collide. `DeepSeek` denotes the harness in `DeepSeek Harness`, `deepseek-harness`, and the `@deepseek-ai` scope, and denotes the MODEL VENDOR in `llm-deepseek`, `api.deepseek.com`, and the provider onboarding copy. A rename that reaches the second one silently breaks the product's ability to call a model while passing every type and lint gate.

## Decision

[`scripts/rebrand.ts`](../../../../scripts/rebrand.ts) follows the shape of [`rescope-vendor.ts`](../../../../scripts/rescope-vendor.ts): ordered literal rules, a protected-path list, post-state assertions, and a `--check` mode. Re-running it after an upstream sync is the maintenance procedure.

Every rule is written so it cannot match the model vendor: each requires the word `Harness`, the `-harness` suffix, or the scope's trailing slash. No rule matches a bare `DeepSeek`. Two postconditions assert the vendor survived, because that failure is invisible to every other gate.

Rule order is load-bearing. `repo-url` precedes `slug` so a URL keeps its owner segment; `env-prefix` precedes `abbreviation` so `DSH_HOME` becomes `LYNESS_HOME` rather than `LYN_HOME`; `pkg-scope` precedes `vendor-scope` so `dsh-tool-cordis` is not read as a vendored package.

### What the word boundary means

The bare `dsh` token refuses a match only when a lowercase letter sits on either side. Treating every identifier character as a boundary protects `handshake` but also refuses `dshHome`, `dsh_home`, `__dsh_main__`, and `subagent_dsh_sdk`, all of which carry the brand. Case changes, underscores, and hyphens stay boundaries.

Three kinds of site remain invisible to any token rule, and each is its own narrow rule carrying the reason: a regex literal whose separator is escaped, a label built by concatenating a component's text with an id, and a fixture name whose meaning depends on sharing the product's prefix. Without the escaped-regex rule, the scope and token rules each rewrite half and produce `@lyness\/lyn-`, a prefix no package carries.

### Paths move with text

Configuration and documentation address workspace directories and Agent Notes by path, so a content-only rename leaves `tsconfig.host.json` pointing at a directory that does not exist. Every run renames tracked paths under the same rules through `git mv`. Binary files are detected by content, not extension: an extension allowlist silently skips whatever it forgot, and these names turn up in stylesheets, JSON Lines fixtures, and a dependency patch.

### Archived Agent Notes stay frozen

`archived/manifest.json` seals each archived artifact by content hash and only ever appends, so changed content is an error the tooling has no path to accept. The archived tree is exempt from every rule, and references to it are masked before rules apply, so links from rewritten documents keep resolving. An address is only useful while it resolves, so it is frozen with what it addresses.

`vendor/README.md` is exempt from the URL rules alone. It records which upstream repository and commit each pinned copy came from; rewriting those URLs would claim the framework was vendored from this fork.

## Alternatives considered

**Rename by hand, once.** The fastest route to a renamed tree, and the reason it loses is in the Problem above: upstream keeps moving, and every sync reintroduces its names in whatever it touched. A rename that cannot be replayed is a cost paid again at every merge, growing with the interval.

**One unordered pass of find-and-replace.** `DeepSeek` names the harness and the model vendor. An unordered pass reaches `llm-deepseek`, `api.deepseek.com`, and the provider onboarding copy, breaking the product's ability to call a model while passing every type, lint, and build gate — an invisible failure. Ordering the rules and requiring `Harness`, `-harness`, or the scope's trailing slash in each is what makes the vendor unreachable.

**Choose the files to rewrite by extension.** An allowlist is easy to read and silently skips whatever it forgot. These names turn up in stylesheets, JSON Lines fixtures, web manifests, and a dependency patch as readily as in TypeScript. Reading the content instead cannot forget a file type nobody anticipated.

**Treat every identifier character as a word boundary.** It protects `handshake`, which is the case that motivates a boundary at all. It also refuses `dshHome`, `dsh_home`, `__dsh_main__`, and `subagent_dsh_sdk`, all of which carry the brand and must follow the rename. Only a lowercase letter continues a word; case changes, underscores, hyphens, and digits are boundaries.

## Consequences

Dropping the product segment from package names cost a distinction the repository relied on. `@deepseek-ai/dsh-*` separated harness packages from the vendored `@deepseek-ai/cordis` family; `@lyness/agent` and `@lyness/cordis` are indistinguishable by name. Three name-prefix checks now use location instead: the license gate and the package-dependency graph exclude `vendor/`, and the plugin-inventory display no longer strips a prefix that cannot occur. Location is the better signal — a package's license follows who wrote it, not what it is called.

Sorted output reorders. The tool catalog sorts by name, and `subagent_lyn_sdk` sorts after `subagent_fork` where `subagent_dsh_sdk` sorted before it, so an expected file whose strings were renamed in place also needed re-sorting.

`--check` cannot see a match its own boundary rule refuses. Residue detection shares the rules, so a token blocked by an adjacent lowercase letter reads as no residue at all. A rename of this size needs a boundary-free survey of the remaining spellings, not just a green check.
