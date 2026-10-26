---
description: "The history section in Settings: what administrators changed, who changed it, and what the change replaced."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-history

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-history` is the Settings section an administrator reads the trail in. One read answers the recorded changes their standing may see, newest first, and each entry shows which record changed, what happened to it, who did it, and both sides of every field that differs. It is read-only by construction: the trail is append-only on the server, so there is nothing here to edit or delete.

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

The Web app mounts it beside the sections whose changes it shows:

```yaml
- id: ui-settings-history
  name: '@lyness/lyn-client-ui-settings-history'
```

There is nothing to configure. The section registers into `settings.section` at order 50, after the bots, and reads `remote.audit` when it is opened.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Read-only by construction.** The trail is append-only on the server, so a surface offering to edit or delete an entry would be offering something the deployment refuses. This section shows and refreshes, and does nothing else.

**Three answers, one of which is worth a retry.** A deployment that keeps no trail will not grow one while the reader waits, and a caller without the standing will not gain it by asking again. Only a read that broke gets the button.

**The read names no organization.** The namespace resolves the one the caller's standing administers, so this surface has no organization field to get wrong — and a platform standing, which administers all of them, reads all of them.

**A kind this build does not know is shown as the server named it.** The set of administrable records is open, so a later owner of them reads here as itself rather than as a blank.

**An empty value is named, not left out.** A field changed to the empty string is a change worth reading, so the row says so rather than showing a gap where a value belongs.

**A cut value is marked where it was cut.** The deployment keeps only the first part of a long value; the row says which field was shortened and why, once per entry.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-admin-audit-controller`](../../api/admin-audit-controller/README.md) — the namespace this section calls, and what each refusal means.
- [`lyn-admin-audit`](../../identity/admin-audit/README.md) — the trail behind it, and what it records.
- [`lyn-client-ui-settings-bots`](../ui-settings-bots/README.md) — one of the two sections whose changes it shows.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it renders a configuration surface, and nothing it shows reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One page, and no cursor** — the newest entries the deployment answers with are shown in one go; older ones are kept and cannot be reached from here.
- **No filter and no search** — every kind, every record and every administrator are shown together; a reader looking for one record's history has to find it by eye.
- **The time is the stored instant** — each entry shows the UTC instant the trail recorded, not a time formatted for the reader's own locale and zone.
- **A record is named by its id** — an entry names the record's identity and the name it went by, and nothing links to the row it describes on the people or bots page.
- **The section is offered to every reader** — a member who opens Settings sees it and reads the notice that they may not read the organization's history, rather than not being offered the section at all. Hiding it needs the navigation to know the caller's standing before the section's own read answers.

**Runtime invariant:** No companion is published. The section renders from one read; there is no second copy to disagree with the deployment.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`kindLabel` and `actionLabel` are exported so the two label mappings are testable without rendering the section, which is also what pins that an unknown kind is shown rather than dropped.

</details>
