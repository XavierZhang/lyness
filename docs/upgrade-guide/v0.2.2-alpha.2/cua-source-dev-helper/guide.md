---
kind: upgrade-guide
description: "Source-built Computer Use helpers use a separate development bundle identifier and need one new macOS permission grant."
---

# Source-built Computer Use helper identity

English | [中文](guide.zh.md)

## Change

Source checkouts previously built `LYN Computer Use.app` with the release bundle identifier `com.deepseek.harness.computer-use` and an ad-hoc signature. They now build `LYN Computer Use Dev.app` with bundle identifier `com.deepseek.harness.computer-use.dev`. Accessibility and Screen Recording grants for the old entry do not apply to it. Desktop and npm installations are unchanged. Source builds still default to ad-hoc signing; developers generate and maintain fixed identities outside LYN home and select them through configuration.

## Migration

1. Keep the default `sourceSigning: ad-hoc` for temporary signatures. To reduce repeated grants after rebuilds and across worktrees, follow the [developer signing skill](../../../../.agents/skills/lyn-cua-macos-signing/SKILL.md) to generate or reuse a certificate, then write `sourceSigning: { identity, keychain }` into the LYN home’s `cordis.patch.yml`; `keychain` must be an absolute path.
2. Start LYN from the source checkout, call Computer Use, and grant Accessibility and Screen Recording to `LYN Computer Use Dev` in System Settings.
3. Confirm that `getCapabilities` reports both permissions as `true`. With a fixed signature, check again after changing and rebuilding Swift code and from another worktree. Remove an old `LYN Computer Use` entry only when no installed LYN uses it.
4. After the keychain locks, rerun setup as described in the skill to unlock and reuse the identity. To stop using it, select `ad-hoc` or remove the configuration, then remove the identity through the skill; deleting LYN home does not delete the developer keychain.
