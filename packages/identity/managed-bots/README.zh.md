---
description: "部署的管理员在运行时维护的那些 bot，每一个都是它所在组织名册里的一条记录。"
kind: "package-reference"
---

# @lyness/lyn-managed-bots

[English](README.md) | 中文

## 概述

`lyn-managed-bots` 是在没人去改组合文件的情况下，一个部署的 bot 的来源。管理员给它起个名字，写下它的性格和它是干什么的，再从部署提供的那些 agent preset 里挑一个；这个 bot 随即加入它所在组织的名册，持有一个成员身份，并拥有它开启的那些会话。租户管理员维护自己组织的 bot，别人的维护不了。bot 永远不会变成一个会登录的人——没有哪个目录能验证一个 bot——也不会变成管理员，因为它的身份是在这里定死的，不是提交上来的。

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

挨着名册，以及提供 bot 可以指名的那些 preset 的注册表：

```yaml
- id: managed-bots
  name: '@lyness/lyn-managed-bots'
```

然后管理员把它们加进来：

```ts
import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-managed-bots'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.managedBots.save({
  displayName: 'Triage',
  organization: 'acme',
  persona: 'You answer in short sentences and ask before acting.',
  job: 'Reads incoming reports and files them.',
  preset: 'standard',
}, by)
```

替换一个会保留它的 id，所以它已经拥有的那些会话仍然是它的。组合写下的 bot 会被列出来，并且任何修改都会被拒绝，因为那个文件在每次启动时都会被重新读一遍。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**bot 是名册里的一条记录，不是一个进程里的对象。**它以 `bot` 这一类人的身份注册进 [`lyn-managed-people`](../managed-people/README.zh.md)，于是归属、可见性，以及每一个要解析拥有者的界面，都不需要第二套机制就能够到它。把它建模成一个进程本地的对象是那些多智能体框架的做法，而那会让 bot 成为这个产品里唯一一个没有身份、也没有任何东西被记在它名下的行动者。

**它的身份是定死的，不是提交的。**每个 bot 持有 `member`。人格是租户管理员写下的自由文本，而一个能管理什么的 bot，就是一个可以被说动去加人或改身份的 bot。一个部署从管理员 bot 那里能得到的任何东西，都不值这个代价。

**它永远不会被准入。**名册回答它，而准入表拒绝它，于是没有哪个目录身份能以它的名义登录。一张把 bot 当人存下来的表，就是准入路径会去读的那张表。

**它的能力是选出来的，不是写出来的。**preset 指的是部署已经挂载好的一套组合。自由文本的能力会让管理员指名一个没人审过的插件，这和登录种类那一行存在的理由是同一个：部署说出有什么可选，租户从中挑。

**一次修改既按提交的内容授权，也按已存储的内容授权**，否则一个租户的管理员只要用自己的组织指名另一个租户的 bot 的 id，就能把它据为己有。

**记录比运行它的那个 preset 活得长。**部署不再提供的 preset 会让 bot 留在存储里并标为 `available: false`。因为某一行离开了 profile 就把它删掉，会丢掉管理员写下的那个性格。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-managed-people`](../managed-people/README.zh.md) — 它们加入的那份名册，以及拒绝它们的那张准入表。
- [`lyn-agent-preset-registry`](../../preset/agent-preset-registry/README.zh.md) — bot 可以指名的那些 preset 从哪里来。
- [`lyn-persona`](../../preset/persona/README.zh.md) — 给一个 agent 它自己的系统提示词的那一行。
- [bot、它所在的团队，和它说话的那个房间](../../../.agents/notes/proposed/architecture/2026-10-22-bots-their-teams-and-their-rooms.zh.md) — 这个包是其中第一部分的那份设计。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它存着一个部署的 bot 都是谁，它持有的东西本身不会进入模型请求。

#### KV Cache 影响

请求前缀不变，因为这里没有任何东西参与请求装配。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **存下来的 bot 还跑不起来** — 名册回答它、管理员维护它，但还没有东西把它的人格和 preset 挂进一个会话。和它开一场对话是这份设计的下一部分。
- **preset 就是全部的能力选择** — 单个技能、MCP 服务器、模型和权限预设还不能按 bot 挑；bot 拿到的正好是它的 preset 组合出来的那些。
- **没有团队也没有房间** — 一个 bot 问不了另一个 bot 任何事，几个 bot 也没法一起讨论一个问题。两者都是同一份设计里靠后的部分。
- **一个 bot 一个组织** — bot 属于部署里那一个被指名的组织，而一个想把某个 bot 只提供给一部分客户的平台，没有办法表达这件事。
- **移除一个 bot 不会结束它拥有的那些会话** — 它的 id 不会被复用，所以那些会话仍然归属到一个已经不再运行的 bot，读到其中一场的人会发现这是一场没人会再作答的对话。
- **没有自己的审计** — 一条记录记着谁在什么时候加了它，而一次替换会把人格覆盖掉，不保留它原来是什么。

**Runtime invariant:** 不发布伴生检查。名册条目只由这个服务从已存储的记录推出，而那些注册就握在持有它们 disposer 的同一张表里。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

Hydration 放在 `[Service.init]` 而不是从构造函数里跑起来，这样拿到这个服务的调用方就能解析出一场由 bot 开启的会话的拥有者；一份在后台慢慢填的名册，会在每次重启之后对最早的那批读者回答 `undefined`。

</details>
