---
description: "What a deployment tells the people using it, for operators writing release notes and maintainers adding a source."
kind: "package-reference"
---

# @lyness/lyn-announcements

English | [中文](README.zh.md)

## Summary

`lyn-announcements` is where a deployment's own release notes and notices live. `./static` serves the ones an operator wrote in composition config, newest first, and a client reads them through the announcement controller. Each announcement carries the release it describes rather than the service reporting one current version: the Host cannot derive a version it can stand behind, while the newest announcement's version is one the deployment has actually claimed. A deployment that mounts no source has nothing to say, which is what a single-operator install is.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

```yaml
- id: announcements
  name: '@lyness/lyn-announcements/static'
  config:
    announcements:
      - id: v0-1-7
        version: '0.1.7'
        publishedAt: '2026-10-15T08:00:00.000Z'
        title: '0.1.7'
        body: |
          - Administrators can grant credits
          - Sign-in through a company directory
        url: https://example.com/releases/0.1.7
```

| Field | Default | Meaning |
|---|---|---|
| `announcements` | `[]` | What this deployment has published |
| `announcements[].id` | required | Stable identity; chosen once and never reused |
| `announcements[].publishedAt` | required | Publication instant, UTC |
| `announcements[].title` | required | The one line a list shows |
| `announcements[].body` | required | The announcement itself, as Markdown |
| `announcements[].version` | — | The release it describes; omitted for a notice |
| `announcements[].url` | — | Fuller notes elsewhere |

An empty list is a complete answer, unlike a roster, where emptiness would lock everyone out.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Ordering happens here, not at the surface.** `published()` answers newest first so every surface agrees on what "latest" means; a list each reader sorts is a list two readers sort differently. Two announcements published at the same instant fall back to their identity, so their order is fixed rather than swapping between reads.

**Two rejections happen at load.** An unparseable `publishedAt` sorts as `NaN` and would land the announcement in an arbitrary place; two entries sharing an identity make "the one a reader dismissed" ambiguous. Both fail where an operator is looking at the file.

**The version belongs to the announcement.** A deployment has many releases behind it and one announcement per release, and a notice that is not about a release has no version at all — so this is a field of each announcement rather than one the service reports.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-announcement-controller`](../../api/announcement-controller/README.md) — how a client reads them.
- [`lyn-client-ui-settings-announcements`](../../client/ui-settings-announcements/README.md) — the row and reader that render them.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it serves deployment-authored text to a surface.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No hosted source** — `./static` is the installation shape's answer. A hosted deployment publishes without editing a customer's config, which needs a store-backed source.
- **No read state** — nothing records which announcements a person has seen, so a surface cannot mark one unread.
- **Written announcements need a restart** — `./static` reads its list at load, so an operator publishing one edits composition config.
- **No scheduling** — an announcement is published the moment it is written; a `publishedAt` in the future is still served.

**Runtime invariant:** No companion is published. The list is one value this package holds, so there are no independent observations of it that could diverge.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`newestFirst` copies before sorting, so a caller's array is never reordered underneath them. A test pins that.

</details>
