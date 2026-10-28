---
description: "这一回合属于谁，文件就在谁自己的机器上；服务器从那里读写。"
kind: "package-reference"
---

# @deepseek-ai/dsh-fs-desktop

[English](README.md) | 中文

## 概述

`dsh-fs-desktop` 是这样一台服务器的 `fs` 提供方：它跑智能体循环，却不拥有任何文件。循环必须在服务器上——积分与模型策略没有别处可落——而文件在使用者正坐着的那台笔记本上。本后端把每一次文件系统操作沿桌面链路送到那台机器，再把答案带回来，失败自己的错误码一并带回。两端都在本包里：宿主侧 provider 与桌面侧 handler；会各自漂移的两端，就是会在生产而非构建时失败的两端。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在服务器上，它就是 `fs` 提供方，无需配置：

```yaml
- id: desktop-link
  name: '@deepseek-ai/dsh-desktop-link'
- id: fs-desktop
  name: '@deepseek-ai/dsh-fs-desktop'
```

在桌面端，handler 对着本机自己的文件系统注册：

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
## 理解实现

**会话说出这是谁的机器。** `FileSystem` 从不问这个问题——它是为只有一台机器的 harness 写的。回合之中，答案来自会话记下的归属人（`@deepseek-ai/dsh-session-ownership`）；回合之外，来自这次请求认证出的人。两者皆无的调用直接失败，而不是猜一台机器：猜，意味着把一个人的文件写到另一个人的磁盘上。

**同步成员要的东西，由目标键携带。** `processPath`、`fileUrl` 与 `contains` 无法往返，于是桌面端在每个目标旁一并送来进程路径、文件 URL 和它自己的路径风格，键把它们收着。键按约定就是不透明的，这正是把这份记录放进键里、而不是放进一份还要失效与设限的缓存里的依据。

**失败作为值传回。** 链路自己的失败通道只带文本，而一个丢了 `FsErrorCode` 的文件系统失败，重试层、权限层与 UI 层就再也无从路由。于是每个操作都答以 `{ ok: true, value }` 或 `{ ok: false, code, message }`，链路的 `failed` 回复则留给「传输断了」这一件事。

**约束留在桌面端。** 服务器可以把某个工具已经解析好的策略传过去，由桌面端自己的后端执行。一个人自己的机器允许什么，服务器没有发言权，所以本 provider 不报告自己的沙箱模式。

**读取是流式的。** 链路边产生边投递，所以 `streamText` 在每一块落地时就交出它，并把最后一条回复读作结果——这也正是一次已经吐出头几个字节之后才失败的读取，仍能报出失败的原因。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [离开单操作者 Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.zh.md) —— 循环与文件为何在不同机器上。
- [`dsh-desktop-link`](../../api/desktop-link/README.zh.md) —— 它所搭乘的通道。
- [`dsh-session-ownership`](../../identity/session-ownership/README.zh.md) —— 「这一回合替谁工作」从哪里来。
- [`dsh-fs-ssh`](../../ssh/fs-ssh/README.zh.md) —— 另一个远端后端，它的执行世界由配置点名，而非由调用方决定。

-----

<a id="model-experience"></a>
## 模型体验

间接存在，经由文件系统工具：模型看到的还是任何后端都会给的 `read`、`write`、`edit` 结果，只是其中的路径指向使用者自己的机器。工具、提示词与 schema 都不变。

#### KV 缓存影响

请求前缀不变，因为本 provider 不贡献任何指令；展示出来的路径只在文件本身不同的地方不同。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有任何 profile 组合它** —— 随附的 `hosted` profile 刻意不跑任何用户代码，并有门禁守着。本后端是桌面端那一半在应用里落地之后，下一阶段才挂上的东西。
- **不支持监听** —— 链路没有「桌面上文件变了」这个方向的事件，所以 `watch` 抛出基类 provider 的拒绝，任何想要文件实时更新的能力都用不了。
- **没有路径映射回宿主** —— `processPathFromHostPath` 什么都不报，因为服务器自己的磁盘与桌面的磁盘是两台机器。把宿主路径交给另一个能力的工具，在这里无路可走。
- **并发属于桌面端** —— 一人一条链路，意味着同一个人的调用在自己机器上互相排队，一次慢读会拖住下一次。
- **字节走 base64** —— 一次大的二进制读取，在线上比在盘上多三分之一。

**运行时不变量：** 不发布伴生检查。往返的两端是对同一个本地后端相隔一步的观察，不存在会发散的第二个观察者。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`FS_ERROR_CODES` 放在 `@deepseek-ai/dsh-fs`，由一个「一码一键」的对象派生，`satisfies` 保证它不缺项；两个远端后端据此校验收到的错误码。给 `FsErrorCode` 加一个分支，构建就会来要那个键。

</details>
