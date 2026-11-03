---
description: "The filesystem of the person whose turn it is, on their own machine, reached from the server."
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-desktop

English | [中文](README.zh.md)

## Summary

`dsh-fs-desktop` is the `fs` provider for a server that runs the agent loop but owns none of the files. The loop has to be on the server — credits and the model policy have nowhere else to hold — while the files are on the laptop the person is sitting at. This backend sends every filesystem operation down the desktop link to that machine and brings the answer back, the failure's own code intact. Both halves live here, Host provider and desktop handler, because two ends that can drift fail in production rather than at build time.

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

On the server, it is the `fs` provider, and it takes no configuration:

```yaml
- id: desktop-link
  name: '@deepseek-ai/dsh-desktop-link'
- id: fs-desktop
  name: '@deepseek-ai/dsh-fs-desktop'
```

On the desktop, the handler registers against the machine's own filesystem:

```ts
import { DesktopExecutor } from '@deepseek-ai/dsh-desktop-link/executor'
import { desktopFsHandler } from '@deepseek-ai/dsh-fs-desktop/handler'
import type { Context } from '@deepseek-ai/cordis'

declare const ctx: Context
declare const executor: DesktopExecutor

const stop = executor.register('fs', desktopFsHandler(ctx.fs))
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The session says whose machine.** `FileSystem` never asks — it was written for a harness that had one. During a turn the answer comes from the session's recorded owner (`@deepseek-ai/dsh-session-ownership`); outside one, from the person the request authenticated as. A call that is neither fails rather than guessing a machine, because guessing means writing one person's file onto another person's disk.

**The target key carries what the synchronous members need.** `processPath`, `fileUrl` and `contains` cannot round-trip, so the desktop sends the process path, the file URL and its own path flavour along with each target, and the key holds them. The key is opaque by contract, which is exactly the licence to put the record there instead of in a cache that would then need invalidating and bounding.

**A failure travels as a value.** The link's own failure channel carries only text, and a filesystem failure that arrives without its `FsErrorCode` is one the retry, permission and UI layers can no longer route on. So every operation answers with `{ ok: true, value }` or `{ ok: false, code, message }`, and the link's `failed` reply is left to mean the transport broke.

**Confinement stays on the desktop.** The server may pass on a policy a tool already resolved, and the desktop's own backend enforces it. The server does not get a say in what a person's own machine allows, so this provider reports no sandbox mode of its own.

**Reads stream.** The link delivers items as they are produced, so `streamText` yields each chunk when it lands and reads the last reply as the outcome — which is how a read that fails after its first bytes are already out still reports the failure.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Diverging from the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why the loop and the files are on different machines.
- [`dsh-desktop-link`](../../api/desktop-link/README.md) — the channel this rides.
- [`dsh-session-ownership`](../../identity/session-ownership/README.md) — where "whose turn is this" comes from.
- [`dsh-fs-ssh`](../../ssh/fs-ssh/README.md) — the other remote backend, whose execution world is named by configuration rather than by the caller.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the filesystem tools: the model sees the same `read`, `write` and `edit` results it sees from any backend, naming paths on the person's own machine. No tool, prompt or schema changes.

#### KV Cache effect

No request prefix changes, because the provider contributes no instructions; a displayed path differs only where the file itself does.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No profile composes it** — the shipped `hosted` profile deliberately runs no user code, and a gate enforces that. This backend is what a later phase mounts once the desktop half ships in the app.
- **Watching is not supported** — the link has no event direction for a file changing on the desktop, so `watch` raises the base provider's refusal and anything that wants live file updates is out.
- **No path maps to the host** — `processPathFromHostPath` reports nothing, because the server's own disk and the desktop's are different machines. A tool that hands a host path to another capability cannot route it here.
- **Concurrency is the desktop's** — one link per person means one person's calls queue against each other on their own machine, and a slow read delays the next one.
- **Bytes travel base64** — a large binary read costs a third more on the wire than it does on disk.

**Runtime invariant:** No companion is published. Both halves of the round-trip are observations of the same local backend, one step apart, so there is no second observer to diverge from.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`FS_ERROR_CODES` lives in `@deepseek-ai/dsh-fs`, derived from a key-per-code object a `satisfies` clause keeps complete, so the two remote backends validate a received code against one list; add an arm to `FsErrorCode` and the build asks for the key.

</details>
