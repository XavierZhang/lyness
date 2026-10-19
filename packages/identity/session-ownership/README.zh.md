---
description: "一个会话是谁的对话，面向需要为自己人的行为负责的托管部署。"
kind: "package-reference"
---

# @lyness/lyn-session-ownership

[English](README.md) | 中文

## 概述

`lyn-session-ownership` 记录一个会话是谁的对话——开启它的那个人，以及他开启它时所处的身份——并通过它的 `./visibility` 行，决定此后谁读得到它。记录在创建时写入一次，取自那次调用所发布的 principal，并且永不改写。私有部署两半都不需要：那里只有一个人。由「没有人」开启的会话（比如一次 CLI 运行或一次入站 webhook）不带归属，而不是带一个编造出来的归属，并读作部署自己的。

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
- id: session-ownership
  name: '@lyness/lyn-session-ownership'

- id: session-visibility
  name: '@lyness/lyn-session-ownership/visibility'
```

两行都不接受配置。写入那半需要会话、投影注册表与请求 principal；规则那半还需要目录，好把平台管理员与其余人区分开。只选写入、不选规则，等于记下了归属却没有任何东西据以行事——在服务多个人的部署上，这意味着他们各自仍能列出并打开别人的对话。

读取方向会话发问：

```ts
import type { Context } from '@lyness/cordis'
import type { Session } from '@lyness/lyn-session'
import { ownerOf } from '@lyness/lyn-session-ownership'

declare const ctx: Context
declare const session: Session

const owner = ownerOf(ctx, session)
if (owner !== undefined) {
  // owner.owner is the person; owner.membership is the standing, when there was one
  void owner
}
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**两个字段，因为一个人不是一个组织。** 一个人持有一个身份，并且可以同时持有好几种成员身份，所以「属于哪个组织」是那次行为的属性、而不是那个人的属性：以某个组织的身份开启的对话属于那个组织，无论它的主人还属于别的什么地方。

**成员身份是被记录的，不是被推导的。** 它的两端都会动。一个离开甲公司、加入乙公司的人，不能把旧对话一起拖进新账下；而一个组织翻看自己的历史时，必须看到每场对话发生时的真实情况。

**写入一次，永不改写。** 会话日志是已发布的数据：记错的归属会永远错下去，而分两步补上的归属要付两次格式变更的代价。投影正是让「一次」可被强制的东西——已经带着记录的会话被原样放过，于是重启不会多写一条。

**「没有归属」是一个真实的答案。** 一次 CLI 运行、一个子 agent、一次入站 webhook，创建的都是没有任何请求 principal 开启的会话。它们不带归属，因为在这里编造的归属是永久的。

-----

<a id="further-exploration"></a>
## 进一步探索

- [会话归属](../../../.agents/notes/proposed/architecture/2026-10-07-session-ownership.zh.md) —— 那个决定，包括「移除一个成员」改变什么、不改变什么。
- [`lyn-request-principal`](../request-principal/README.zh.md) —— 开启者从哪里来。
- [`lyn-tenant-session`](../../tenant/tenant-session/README.zh.md) —— 它并不取代的那个「部署级租户」印记。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：`session/owner` 是只进日志的归属记录，不进入模型转录。模型是在回答一个人，不是在读他的账户。

#### KV Cache effect

没有任何请求前缀发生变化，因为该事件从不进入被组装的请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **每个读取方都会问，只是问法不同** —— Remote 会话界面按进行中的那次调用问；`session_query` 工具按它的 Agent 正在运行的那场对话问，因为 Agent 不携带 principal；`/export` 路由两样都问不了，于是在有人名的地方整条收起，而不是把一个人的日志发给另一个人。
- **Agent 只读得到它那场对话的归属人读得到的** —— 对一个人自己的委派来说这是对的，对一个本该跨人检索的部署级助手来说是错的；今天没有东西表达得出后一种情形。
- **「移除成员即归档」尚未实现** —— 那个决定从主人的成员身份推导出归档状态；今天没有东西这样读它。
- **「无归属」与「归属之前」无法区分** —— 两者都读成没有归属，所以一个较晚才挂上本插件的部署，分不清哪些旧会话只是早于它。
- **托管部署仍然可以创建无归属的会话** —— webhook 与子 agent 的会话本来就没有 principal，所以在这里不能把「缺席」判为错误。

**Runtime invariant:** 不发布任何 companion。这条记录只有一个写入方与一个读取方，都在会话自己的日志里，所以不存在可能分歧的两份观察。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`session/owner` 与其他每一个 `SessionEventMap` 成员一样是读取时必需的：一个不认识它的构建会拒绝这份日志，而不是在没有归属的情况下把别人的对话端出来。

</details>
