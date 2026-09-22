# Agent Note: The real-API e2e platform is configuration, not a literal

Status: implemented

English | [中文](2026-09-22-configurable-e2e-platform.zh.md)

## Problem

The real-API e2e suites could reach another DeepSeek-compatible platform through `DEEPSEEK_BASE_URL`, but nothing else about the target was configurable. About twenty suites named the official model `deepseek-v4-flash` as a literal, and the product's built-in catalog offers only official names, so every web and profile suite that takes the app's default model would ask another platform for a model it does not serve. A run against any platform but the official one failed for reasons that described the platform, not the code.

The obvious fix — an overlay per suite that swaps the catalog — would have meant editing some forty to fifty upstream test files, each a merge conflict waiting for the next upstream change to that suite.

## Decision

The platform is chosen by the variables the product already reads. `@lyness/lyn-llm-deepseek` gains `DEEPSEEK_MODELS`, a comma-separated catalog read from the same trusted environment layers as `DEEPSEEK_BASE_URL`, and the new test-support package `@lyness/lyn-e2e-target` resolves the model a suite sends from that same variable. Environment variables reach every process a suite spawns, so the web and profile suites need no edits at all.

Four rulings shape it.

**The variable replaces the composition's catalog, and a saved catalog still wins.** A catalog written for one endpoint is wrong for another, so merging would offer models the chosen endpoint does not serve. The replaced catalog becomes the base settings layer, which keeps the user's own saved catalog on top — the precedence the Models page already has.

**The schema default stays.** Distinguishing "configured" from "defaulted" would have meant removing `models`' schema default, and the Models page renders that default as the provider's catalog. Replacing the composition value one layer up leaves both the page and the unconfigured runtime exactly as they were.

**Official-only features skip rather than fail.** Prompt-cache accounting and the Anthropic-compatible endpoint a Claude Code child uses exist only on the official API. On another target those suites skip with the reason in their title, because a red result there would report the platform. The Claude Code suite previously threw on a non-official endpoint; it now skips.

**Unset means official.** With neither variable set, every suite calls exactly what it called before, and the fork's CI sets the endpoint explicitly, as upstream does, so a stray `.env` cannot redirect a run.

## Alternatives considered

**An overlay per suite that swaps the catalog.** No product change. It touches forty to fifty upstream test files and every future suite has to remember it.

**A test-only variable such as `LYNESS_E2E_MODEL`.** Simple to add. It lets the suites and the product disagree — a suite asking for one model while the app offers another — which is the failure this work removes.

**A logical-to-wire model name mapping in the provider.** The suites could keep saying `deepseek-v4-flash` while the provider sends the platform's name. It invents an aliasing concept the provider does not have, for which the only consumer is the test suite.

**Keep e2e pinned to the official API, as upstream does.** No change at all. The fork serves tenants who reach DeepSeek through their own gateways, and the suites should be able to prove the product works there too.

## Consequences

A private deployment can also point the provider at a third-party DeepSeek endpoint with its own model names without editing composition config. Each id becomes a text-only entry with the default context window; a model that takes images still needs a settings entry.

The suites use one model per run: the first id the variable names.

The change touches one upstream product file, about twenty upstream suites where a literal became `E2E_TARGET.model`, two YAML fixtures that now read the variable through `!!js`, and the official-only gates. `CUSTOM.md` records them.

None of this has run against a real endpoint yet: this workspace has no key and the fork's Actions are billing-locked. The suites load and self-skip keyless, and the provider change is covered by unit and settings-layer tests.
