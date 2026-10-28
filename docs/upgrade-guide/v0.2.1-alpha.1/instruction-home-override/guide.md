---
kind: upgrade-guide
description: "The `agent-instructions` row no longer accepts `lynHome`; instruction loading always resolves the harness home from `$LYNESS_HOME` or `~/.lyn`."
---

# Instruction loading resolves one harness home

English | [中文](guide.zh.md)

## Change

`@lyness/lyn-agent-instructions` removed its `lynHome` config field. The plugin resolves the harness home through `resolveLynHome()` from `@lyness/lyn-home-paths`, like every other harness consumer: the home is `$LYNESS_HOME` when it is set and non-blank, otherwise `~/.lyn`, with tilde expansion.

A `cordis.yml`, profile patch, or `--patch` overlay that still sets `lynHome` on the `agent-instructions` row has no effect: the row keeps the stray key and the plugin ignores it, so instruction loading follows the process home. Other providers, such as `lyn-skill-filesystem` and `lyn-shell-env`, keep their own home fields; this removal covers the instruction loader only.

## Migration

1. Delete `lynHome` from the `agent-instructions` row in `cordis.yml`, `$LYNESS_HOME/cordis.patch.yml`, `$LYNESS_HOME/profiles/<profile>/cordis.patch.yml`, and any `--patch` overlay.
2. Where the override pointed at a non-default home, export `LYNESS_HOME` for the process instead, so every harness consumer reads that home.
3. Confirm with `lyn --profile <profile> --dump-config` that the `agent-instructions` row lists only its remaining fields, and that a new session's first request shows `Instructions from: $LYNESS_HOME/AGENTS.md` (or `~/.lyn/AGENTS.md`) when that file exists.
