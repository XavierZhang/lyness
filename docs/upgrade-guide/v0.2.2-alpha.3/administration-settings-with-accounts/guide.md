---
kind: upgrade-guide
description: "The sign-in channels, people, bots and history Settings pages ship with lyn-module-accounts instead of lyn-web-app."
---

# Administration Settings pages follow the account plane

English | [中文](guide.zh.md)

## Change

Four Settings pages move from `@lyness/lyn-web-app` to `@lyness/lyn-module-accounts`: sign-in channels, people, bots and history. They read the account plane — `remote.signInChannels`, `remote.people`, `remote.bots` and `remote.audit` — which only that module's controllers provide.

A profile that lists `@lyness/lyn-module-accounts`, including the shipped `enterprise` and `hosted` templates, is unchanged: the pages arrive with the module, beside the controllers that answer them. A profile without it, including the shipped `web` template, no longer carries the four pages. It never served them: the pages injected namespaces nothing mounted, so Cordis parked them and the plugin inventory page reported a sync failure that no retry could clear.

`@lyness/lyn-api-remotes` now mounts the `announcements`, `credits`, `identity`, `people`, `bots`, `audit` and `signInChannels` namespaces, so the pages that inject them activate wherever their controllers are composed.

## Migration

1. A deployment that wants the four pages lists `@lyness/lyn-module-accounts` in its profile's bundle list, which also brings the controllers they read.
2. A composition that referenced one of the four plugin rows by id in a patch layer re-targets that patch at the row in `module-accounts`, whose ids are unchanged (`ui-settings-sign-in-channels`, `ui-settings-people`, `ui-settings-bots`, `ui-settings-history`).
3. Open Settings and confirm the four pages appear where the account plane is composed and that the plugin inventory page reports no sync failure.
