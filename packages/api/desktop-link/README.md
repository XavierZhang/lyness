---
description: "The Host-to-desktop link, for deployments running the turn on a server and the work on a person's own machine."
kind: "package-reference"
---

# @lyness/lyn-desktop-link

English | [中文](README.zh.md)

## Summary

`lyn-desktop-link` is one authenticated channel per signed-in person, over which the Host asks that person's own machine to do work. The direction is what is new: every other Remote surface runs Client to Host, and this runs Host to Client, because the agent turn is on the server while the files it works on are on the laptop. It needs no new transport — a Remote stream already carries Host items down and Client items up on one logical stream, over the carrier the desktop opened, so a desktop behind NAT needs nothing listening on it.

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

The server mounts the link and its Remote surface:

```yaml
- id: desktop-link
  name: '@lyness/lyn-desktop-link'
- id: desktop-link-controller
  name: '@lyness/lyn-desktop-link/controller'
```

A capability provider on the server reaches one person's machine through `ctx.desktopLink`:

```ts
import type { DesktopLink } from '@lyness/lyn-desktop-link'
import type { PersonId } from '@lyness/lyn-people'

declare const link: DesktopLink
declare const person: PersonId

for await (const item of link.call(person, 'subprocess', 'spawn', { command: 'true' })) {
  // every item the machine produced, then its final value last
  void item
}
```

The desktop attaches through the `desktopLink` Remote namespace and serves the calls from the capabilities it mounts:

```ts
import { DesktopExecutor } from '@lyness/lyn-desktop-link/executor'

const executor = new DesktopExecutor()
const stop = executor.register('subprocess', {
  perform: async function* (operation, payload, signal) {
    void operation; void payload; void signal
    yield { exitCode: 0 }
  },
})
void stop
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One link per person, and the newest connection wins.** Two machines answering for one person would make "run this on my laptop" ambiguous, so a second connection replaces the first rather than joining it; the one the person is sitting at is the one that just connected.

**A call is an iterable because work arrives as it is produced.** A command's output is not available only at the end, and a caller that wants just the final value iterates to it. The handler says which item is final by producing it last, so no handler needs a separate "this one is the result" flag.

**The uplink ending ends the link.** A desktop that half-closes its uplink has stopped answering, so every call in flight fails with `desktop-lost` rather than waiting on a machine that will never reply.

**A call the desktop cannot serve is refused, not dropped.** A Host waiting on a reply that never comes cannot tell a missing capability from a slow machine, and the turn would hang instead of saying what is absent.

**The link belongs to the person the call speaks for.** `attach` reads the principal from the session the desktop presented, so a desktop cannot attach as someone else by sending a different name.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Leaving the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why the turn is on the server and the work is not.
- [`lyn-request-principal`](../../identity/request-principal/README.md) — where the attaching person comes from.
- [`lyn-api-gateway`](../gateway/README.md) — the carrier, and the suite that covers it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it carries work between a Host and a machine.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No capability provider uses it yet** — `subprocess-desktop` is the first, and until it lands the link carries nothing in a shipped profile.
- **No executor plugin** — `DesktopExecutor` is a class a desktop composition drives; the plugin that opens the stream and feeds it is not written.
- **One machine per person** — a person with a laptop and a workstation reaches whichever connected last, with no way to name the other.
- **No backpressure** — queued requests and delivered items are held in memory, so a desktop that stops consuming grows the queue rather than slowing the Host.

**Runtime invariant:** No companion is published. Each link is one in-memory relation with a single observer, and a lost link is observed through the calls that fail with it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The wire carries JSON, so a queued item is never `undefined` — the empty value is `null`. That is what lets `call` treat an absent shift as an empty queue; a test pins that a `null` item is delivered rather than skipped.

`release` deletes the recorded link unconditionally: a replaced link was already closed by the replacement's own `close`, and a closed link returns early, so the body only ever runs for the current one.

</details>
