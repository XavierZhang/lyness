---
description: "The system-announcements row in General Settings, for deployments publishing notes and maintainers changing the reader."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-announcements

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-announcements` adds the system-announcements row to General Settings, beside the current-version row. The row names the newest announcement's title and opens a reader listing all of them with their dates and the releases they describe. What it shows comes from the deployment the client connected to, read through `remote.announcements`, so a desktop install and a browser each read their own server. The read starts when the reader opens, because a deployment with nothing to say is the ordinary case.

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
- id: ui-settings-announcements
  name: '@lyness/lyn-client-ui-settings-announcements'
```

It takes no configuration. The deployment needs an announcement source and the announcement controller mounted; without them the Remote namespace is absent and the row reports that the announcements could not be read.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It sits beside the version.** A reader looking for what changed and a reader looking for which version they are on are the same reader, and the version a release note names is the one the deployment has claimed — so the row follows the current-version row rather than opening a section of its own.

**The read starts with the reader, not with the row.** Settings open far more often than announcements are read, and a deployment with nothing to say is the ordinary case, so a reader who never opens this costs no request. One in-flight read is shared, so opening twice does not ask twice.

**A failure says only that it failed.** The reason belongs to the transport and a reader can only retry, so the row offers that rather than a message nobody can act on. Retrying drops the previous outcome first, so what a reader sees is the attempt rather than a stale failure.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-announcements`](../../host/announcements/README.md) — where the announcements are written.
- [`lyn-api-announcement-controller`](../../api/announcement-controller/README.md) — the read this row performs.
- [`lyn-client-ui-settings-general`](../ui-settings-general/README.md) — the section this row joins.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it renders deployment-authored text in Settings.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No unread mark** — nothing records which announcements a person has seen, so the row cannot draw attention to a new one.
- **No refresh while open** — the reader shows what the read returned; an announcement published meanwhile arrives on the next open.
- **The body is trusted Markdown** — it is the deployment's own text, rendered by the shared Markdown primitive; a deployment that lets an untrusted author write it would be publishing that author's Markdown.

**Runtime invariant:** No companion is published. The row renders one store whose only writer is its own read.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The Host half registers nothing. It exists so the package has a Host entry its client bundle is mounted beside, which is what `lyn.client` requires.

</details>
