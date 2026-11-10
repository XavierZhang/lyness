---
kind: upgrade-guide
description: "Administration moves out of Settings into a console at /admin, and its pages register admin.section."
---

# Administration is a page, not a Settings plane

English | [中文](guide.zh.md)

## Change

The administration pages — models, built-in plugins, agent modes, sign-in channels, people, bots, credits, change history — no longer appear in the Settings window. They render in the administration console, a page of its own at `/admin`, with its own navigation and its own sign-in page. Settings keeps one plane: what a person decides for themselves.

Three surfaces change with it:

| Before | After |
|---|---|
| slot `settings.administration.section` | slot `admin.section`, declared by `lyn-client-ui-admin-console` |
| `lyn-host-frontend-static` served the index at `/` only | `documentPaths: ['/admin']` makes it answer that path with the document too |
| `lyn-web-app` had no page configuration | `documentPaths` passes those paths through to the dist server |

`SettingsRootInjected.hooks` loses `administrationSections` and `administers`, and `lyn-client-ui-settings-general` no longer exports `administersSource`.

This affects a deployment that composes its own client rows, a plugin that registers an administration page, and anything that read those hooks. A person using the product sees the same Settings minus the administration group; an administrator opens `/admin`.

## Migration

1. Compose the console and the page it lives on, in the same composition:
   ```yaml
   - id: web-runtime
     name: '@lyness/lyn-web-app'
     config:
       documentPaths:
         - /admin
   - id: ui-admin-console
     name: '@lyness/lyn-client-ui-admin-console'
     config:
       path: /admin
   ```
   The two paths must match: the Host decides which paths carry a document, `path` decides which one is the console. A `documentPaths` entry is one absolute segment, such as `/admin`.
2. Rename the slot in any administration page you own: `ctx.slots.inject('admin.section', …)` and `name: 'admin.section'`, plus `PropsRuntime<'admin.section'>` in its component. The owner share is unchanged, so the component needs no other edit.
3. Drop any read of `administrationSections` or `administers` from a Settings shell replacement; the console decides what it offers from `ctx.uiViewer` and `admin.section`.
4. Confirm it: open `/admin`, which shows the console with the pages your composition mounts, and open Settings, which no longer lists them. `apps/web/tests/admin-console.e2e.ts` asserts both in a real browser.
