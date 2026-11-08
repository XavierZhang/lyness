---
kind: upgrade-guide
description: "people、bots 与 signInChannels 三个 Remote 命名空间改为在 delete 上应答，不再是 remove。"
---

# Remote 的 `remove` 方法改名为 `delete`

[English](guide.md) | 中文

## 变更

三个 Remote 方法改名，旧名字直接消失，没有别名：

| 变更前 | 变更后 |
|---|---|
| `people/remove` | `people/delete` |
| `bots/remove` | `bots/delete` |
| `signInChannels/remove` | `signInChannels/delete` |

客户端以 `ctx.remote.people.delete(id)`、`ctx.remote.bots.delete(id)` 与 `ctx.remote.signInChannels.delete(id)` 调用它们。它们背后的 Host 服务没有变：`ctx.people.remove`、`ctx.managedBots.remove` 与 `ctx.signInChannels.remove` 保持原名，因为它们不是 Remote 命名空间。

这影响任何点名过这三个 wire 方法的客户端插件、SDK 使用方或 JSON-RPC 调用方。此前没有任何浏览器调用得到它们：`remote.<命名空间>` 是一个 Cordis 服务，每个方法都作为它的成员装上去，所以与该服务自身成员同名的方法——`remove` 就是其中一个——根本装不上，挂载这个命名空间会失败。而这三个从来没被挂载，因此没有界面碰到它们，这处撞名也一直看不见。

`verify-client-remote-namespaces` 现在在门禁上就拒绝保留的方法名，[Gateway 客户端](../../../../packages/api/gateway/src/client/index.ts)里的 `isReservedRemoteMethod` 是门禁与挂载共同询问的那一份清单。

## 迁移

1. 逐处改名：`ctx.remote.people.remove(id)` 改为 `ctx.remote.people.delete(id)`，`bots` 与 `signInChannels` 同理。
2. 在点名了这些方法的 JSON-RPC 或 ACP 载荷里改名，例如 `{"method": "people/remove"}` 改为 `{"method": "people/delete"}`。
3. Host 一侧的调用不要动；移动的只有这三个 Remote 方法。
4. 运行 `pnpm run verify-client-remote-namespaces`：没有 Remote 方法占用保留名、且每个被注入的命名空间都已挂载时它通过。
