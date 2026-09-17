# Agent Note: The Python import packages carry the fork's name

Status: implemented

English | [中文](2026-09-17-python-package-rename.zh.md)

## Problem

The rebrand codemod renamed the Python distributions to `lyness-sdk` and `lyness-runtime-bin`, but nothing renamed what a caller imports. The SDK still installed a module named `deepseek_harness`, and the bundled runtime a module named `deepseek_harness_runtime`, so a fork user wrote `from deepseek_harness import DeepSeekHarness` against a package published under another name.

The same spelling had already broken the release. A wheel file name is the distribution name with underscores, so the build produced `lyness_sdk-<version>-py3-none-any.whl` while `.gitlab-ci.yml`, the GitHub workflows, `scripts/build-python-release.py`, and the development guides still asserted `deepseek_harness_sdk-…` and `deepseek_harness_runtime_bin-…`. Nothing caught it, because no gate builds a wheel.

`python/sdk/uv.lock` was stale in the same way: the codemod protects it as a generated file, and `pnpm install` does not regenerate it, so it still pinned `deepseek-harness-sdk` and `deepseek-harness-runtime-bin` against manifests that name neither.

## Decision

One codemod rule, `python-package`, renames `deepseek_harness` to `lyness`. Because the runtime module and the wheel-name tokens are that same string with a suffix, the one rule also produces `lyness_runtime`, `lyness_sdk`, and `lyness_runtime_bin`. The codemod's existing path pass renames the two package directories with `git mv`, so the modules and the manifests that name them move together.

`uv lock --project python/sdk` regenerates the lock, and the post-rebrand checklist in `CUSTOM.md` gains that step: a generated file the codemod may not touch is a file some other tool has to rewrite.

The underscore spelling can only mean the harness. The model vendor's packages and endpoints carry no underscore, which is what lets this rule run without a boundary.

## Alternatives considered

**Keep the upstream import name.** Nothing to rename, and any code written against upstream's module keeps working. It leaves the fork publishing `lyness-sdk` whose import line names a different product, and leaves the wheel-name mismatch to be fixed separately.

**Edit the files by hand.** Fewer moving parts for a rename this size — about 113 lines. An upstream sync restores the tree from upstream and replays the codemod, so a hand edit is lost on the next merge; only a rule replays.

**Two rules, one per module.** `deepseek_harness` and `deepseek_harness_runtime` would each state their own target. The second is a suffix of the first, so one literal rule already covers both, and two rules would have to agree on order to avoid producing `lyness_harness_runtime`.

## Consequences

An SDK user imports `lyness` and `lyness_runtime`. The change is not source-compatible with upstream, and the packages are pre-release (`0.0.0.dev0`), so no published version carried the old import path under the fork's name.

The release workflows now name the files the build produces. That path stays unverified here: no gate builds a wheel, so the next release run is the first confirmation.

`uv.lock` is regenerated rather than rewritten by the codemod, which keeps `uv` the only writer of its own lock, and makes the checklist step the thing that must not be forgotten after a sync.
