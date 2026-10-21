---
description: "把「当前这次调用是谁」发布出来，由它出示的持有凭据解析而来，并且不拒绝任何东西。"
kind: "package-reference"
---

# @lyness/lyn-request-principal

[English](README.md) | 中文

## 概述

挂上 `lyn-request-principal`，任何需要知道「这次调用是谁」的东西就读同一处，而不是各自再去解析一遍头。它注册一个 Connection 请求作用域，把出示的持有凭据解析成「签入的那个人」以及「他的会话当前生效的上下文」，并在这次调用期间发布它。它只解析、从不拒绝：一次没有出示会话、或出示了已失效会话的调用会以「没有 principal」继续，而要求 principal 的那个操作在能说明理由的地方拒绝它。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```yaml
- id: request-principal
  name: '@lyness/lyn-request-principal'
```

它不接受任何配置，需要一个会话存储以及宿主 connection。一个操作读取它正在服务的那次调用的 principal：

```ts
import type { RequestPrincipal } from '@lyness/lyn-request-principal'

declare const principals: RequestPrincipal

const principal = principals.current()
if (principal === undefined) throw new Error('this operation requires a signed-in caller')
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**两种凭据形式都读**，因为两类调用方都存在：浏览器持有 `lyn_identity` cookie，而桌面客户端或脚本发送 `Authorization: Bearer`。只读其中一种，会让另一种无声地变成匿名。两者都在时头优先，于是一个显式凭据胜过一个环境里的凭据。

**它只解析、从不拒绝。** 该请求作用域在认证、主机信任与信封解码都已接受这次调用之后才运行，所以按约定它不是拒绝调用的地方。因此「未知会话」与「已失效会话」是同一个答案——这次调用不代表任何人——而拒绝属于要求 principal 的那个操作，那里也正是能给出理由的地方。

**上下文来自会话，而不是来自请求。** 一次调用不说自己以哪个身份行事；持有那件事的是它的会话，并且只能由一次显式切换改变。正是这一点让「一个人的两个成员身份」永远不会被按调用猜一次。

**比调用活得更久的工作要重新进入 principal。** 流的后续帧由传输层拉取，而不属于任何一次自己的调用，因此那里的 `current()` 是空的，否则共用同一任务的那次请求就会替它们作答。`as(principal, run)` 以 `current()` 已经返回过的 principal 运行一段后续工作；它不解析任何人、也不放宽任何权限，并且「没有 principal」也会被当作「没有」进入，于是一次重新进入永远不会继承另一次调用的身份。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-auth-session`](../auth-session/README.zh.md) —— 本作用域所读取的那些会话。
- [`lyn-credits`](../../credits/credits/README.zh.md) —— 第一个使用方：`./subject-request` 把一次调用计费给它所代表的那个人。
- [人、成员关系与调用所处的上下文](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md) —— 为什么上下文是会话状态、而不是一个请求字段。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它发布的是宿主侧的请求状态。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **只有 RPC 调用携带 principal** —— 该作用域注册在共享 RPC 通道上，所以在调用之外启动的工作（包括一个活得比它的请求更久的后台作业）没有 principal。
- **目前还没有任何东西设置那个 cookie** —— 签发会话并决定 cookie 属性是签入流程的事；本包只读取被出示的东西。
- **匿名调用没有审计** —— 一次出示了已失效会话的调用，事后与一次什么都没出示的调用无法区分，而一个要排查「反复被签出」的部署会想把两者分开。

**Runtime invariant:** 不发布任何 companion。被发布的 principal 是「被出示的凭据」与「会话存储」的函数，并且只在一次调用期间持有。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`read` 里那次被吞掉的错误是刻意且狭窄的：它把「会话不可用」变成「匿名调用」。如果它将来扩大到把存储故障也一并吞掉，那么存储一坏、每一次调用都会无声地变成匿名——那个结果比失败糟得多。

</details>
