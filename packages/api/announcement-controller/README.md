---
description: "The authenticated Remote read of a deployment's announcements, for maintainers wiring the controller."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-announcement-controller

English | [中文](README.zh.md)

## Summary

`dsh-api-announcement-controller` exposes one read: what this deployment has announced, newest first. It is a controller rather than something a client builds in, because the answer belongs to the server that client connected to — a desktop install and a browser each reach their own deployment, so what they should read is whatever that deployment publishes rather than whatever was baked into a client bundle. Read-only: an announcement is written where the deployment is configured, so there is nothing here for a reader to change.

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
- id: announcement-controller
  name: '@deepseek-ai/dsh-api-announcement-controller'
```

It takes no configuration and needs an announcement source. A client calls it through the `announcements` Remote namespace:

```ts
import type { Announcement } from '@deepseek-ai/dsh-api-announcement-controller/types'

declare const remote: { announcements: { published: () => Promise<readonly Announcement[]> } }

const announcements = await remote.announcements.published()
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It adds nothing of its own.** The order, the rejections, and the text are all the source's; this is the address a client reaches them at. A controller that reordered or filtered would make two surfaces disagree with the deployment that published them.

**The source is injected.** A deployment that mounts no announcements mounts no controller either, so a client asking finds the namespace absent rather than an empty list it cannot tell apart from "nothing published".

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-announcements`](../../host/announcements/README.md) — the source this reads.
- [`dsh-client-ui-settings-announcements`](../../client/ui-settings-announcements/README.md) — the only consumer.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it serves one Remote read.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No push** — a client reads on demand; an announcement published while someone has the page open does not reach them until they ask again.
- **No per-person filtering** — every caller reads the same list, so a deployment cannot address one organization's staff.

**Runtime invariant:** No companion is published. This controller holds no state; the one relation it serves is the source's own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`./types` re-exports the source's vocabulary rather than restating it, so a client and the Host cannot drift on what an announcement is.

</details>
