---
kind: upgrade-guide
description: "The people, bots and signInChannels Remote namespaces answer on delete instead of remove."
---

# Remote `remove` methods renamed to `delete`

English | [中文](guide.zh.md)

## Change

Three Remote methods are renamed, and the old names are gone with no alias:

| Before | After |
|---|---|
| `people/remove` | `people/delete` |
| `bots/remove` | `bots/delete` |
| `signInChannels/remove` | `signInChannels/delete` |

A client reaches these as `ctx.remote.people.delete(id)`, `ctx.remote.bots.delete(id)` and `ctx.remote.signInChannels.delete(id)`. The Host services behind them are unchanged: `ctx.people.remove`, `ctx.managedBots.remove` and `ctx.signInChannels.remove` keep their names, because they are not Remote namespaces.

This affects any client plugin, SDK consumer, or JSON-RPC caller that named one of the three wire methods. No browser could call them before: a `remote.<namespace>` is a Cordis service and each method is installed as a member of it, so a method named like one of that service's own members — `remove` among them — could not be installed, and mounting the namespace failed. Nothing mounted these three, so no surface reached them and the collision stayed invisible.

`verify-client-remote-namespaces` now rejects a reserved method name at the gate, and `isReservedRemoteMethod` in [the Gateway client](../../../../packages/api/gateway/src/client/index.ts) is the one list both the gate and the mount ask.

## Migration

1. Rename each call: `ctx.remote.people.remove(id)` becomes `ctx.remote.people.delete(id)`, and the same for `bots` and `signInChannels`.
2. Rename the method in any JSON-RPC or ACP payload that names it, for example `{"method": "people/remove"}` to `{"method": "people/delete"}`.
3. Leave Host-side calls alone; only the three Remote methods moved.
4. Run `pnpm run verify-client-remote-namespaces`: it passes when no Remote method takes a reserved name and every injected namespace is mounted.
