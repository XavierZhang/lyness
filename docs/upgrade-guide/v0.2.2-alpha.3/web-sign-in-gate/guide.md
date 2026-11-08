---
kind: upgrade-guide
description: "The Web client covers the product with the sign-in dialog until this installation can reach a model, and the credits Settings section ships with the credits module."
---

# Sign in before the product, and the credits section follows its ledger

English | [中文](guide.zh.md)

## Change

`@lyness/lyn-client-ui-settings-account` accepts `requireSignIn`, and `@lyness/lyn-web-app` sets it. On it, the sign-in dialog covers the product rather than sitting beside it — but only while **both** are true: nobody is signed in, and no model is reachable. A provider named in any `llm-*` settings namespace counts as reachable, including one whose key comes from the environment and therefore stores no secret, so an installation that already runs tasks is never covered. The covering dialog's secondary action lets the person through for that page load so they can reach Settings and add a key; nothing is written, and the next load asks again until a credential exists. The field is off by default, so every other profile is unchanged.

The `credits` Settings section moves from `@lyness/lyn-web-app` to `@lyness/lyn-module-credits`. Without a ledger the namespace answers `credits/anonymous`, so a deployment that does not meter showed a section whose only content was that refusal. The `credits` Remote namespace still mounts everywhere, as before.

## Migration

1. A deployment that wants the product usable before any credential sets `requireSignIn: false` on the `ui-settings-account` row in its own patch layer.
2. A deployment that wants the credits section lists `@lyness/lyn-module-credits` in its profile's bundle list; the shipped `hosted` template already does.
3. Start the Web client with no credential configured and confirm the sign-in screen opens over the product; configure a provider and confirm it does not.
