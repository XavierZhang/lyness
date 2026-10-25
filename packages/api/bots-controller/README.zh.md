---
description: "管理员在运行时维护自己组织那些 bot 的界面。"
kind: "package-reference"
---

# @lyness/lyn-api-bots-controller

[English](README.md) | 中文

## 概述

`lyn-api-bots-controller` 拥有 `bots` 这个 Remote 命名空间：一个身份所管理的那些 bot、一个 bot 可以被给到的那些 agent preset、它们所在的那些团队，以及添加、修改和移除两者的那些调用。谁可以改什么，它一点也不决定——那些规则在 `lyn-managed-bots` 手里，这个命名空间把调用所处的身份交给它，再把它的回答报出来。每一行都会说明组合是否拥有它、以及它的 preset 是否仍被提供，于是界面会禁用自己改不了的那一行，并标出一个跑不起来的 bot。

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

账户模块把它挂在它所代言的那份名册旁边：

```yaml
- id: bots-controller
  name: '@lyness/lyn-api-bots-controller'
```

一个配置界面先读出一个 bot 可以被给到什么，再添加一个：

```ts
import type { BotInput, BotRowView, PresetOptionView } from '@lyness/lyn-api-bots-controller/types'

/** The two reads one bot form makes, and the call that saves it. */
export interface BotForm {
  readonly presets: () => Promise<readonly PresetOptionView[]>
  readonly list: () => Promise<readonly BotRowView[]>
  readonly save: (input: BotInput) => Promise<BotRowView>
}
```

每一次拒绝都以它自己的错误码到达——`bots/not-permitted`、`bots/written`、`bots/unknown-preset`、带着要标记字段的 `bots/incomplete`，以及 `bots/no-standing`——于是表单禁用某一行或标出某一个字段，而不是去匹配文字。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**规则是名册的。**一个身份管理它自己的组织，bot 的身份是定死的而不是提交上来的，它的 preset 必须是部署提供的那些之一。这些规则中的任何一条在这里再写一遍，都是一条要和原来那条保持同步的规则，而且是直接调用方可以绕开的那条。

**preset 列表也来自名册。**`presets` 问的是 `ctx.managedBots.offers()`，而不是自己去读注册表，因为那正是一次保存被校验所依据的那份列表：表单提供一份列表而名册校验的是另一份，会拒绝掉它刚刚自己给出的选项。

**团队在这里维护，但还不起任何作用。**团队成员身份将来是一个 bot 有权问另一个的来源；在那个操作落地之前，团队只是一条存下来的关系，别无其他。真正要紧的那条拒绝已经立起来了：一个团队只能装它自己组织的 bot，否则「有权问」就会跨过组织边界。

**一次被拒绝的调用指明的是规则，不是文字。**每个原因对应一个错误码，而 `bots/incomplete` 带上字段，好让表单标出它。

**一次调用要么处在某个身份里，要么根本不会发生。**在一个没有挂授权规则的部署上，每一次调用都会到达这里，而一个在无身份状态下被添加的 bot，是一个没人为之负责的 bot。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-managed-bots`](../../identity/managed-bots/README.zh.md) — 这个命名空间所代言的那份名册，以及它执行的每一条规则。
- [`lyn-api-people-controller`](../people-controller/README.zh.md) — 面向那些会登录的人的同胞界面。
- [`lyn-module-accounts`](../../bundle/module-accounts/README.zh.md) — 把两者都选上的那份组合。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它是一个配置界面，它承载的东西都不会进入模型请求。

#### KV Cache 影响

请求前缀不变，因为这里没有任何东西参与请求装配。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **和 bot 开对话是在别处发生的** — 这个界面维护的是那些记录；指名一场会话面对哪个 bot，是 `session.create` 的事。
- **没有分页** — `list` 和 `teams` 在一次回复里答出这个身份所管理的一切，一个有上百个的组织会感觉到这一点。
- **团队暂时不改变任何事** — 还没有东西去问队友，所以团队是一条管理员可以维护、而没有 bot 能用上的记录。
- **没有东西说明某个 preset 为什么没被提供** — 一个无法组合出会话的 preset 只是不出现在 `presets` 里，并不说明是哪一行失败了。
- **没有自己的审计** — 名册记着谁在什么时候加了一个 bot；这个命名空间什么都不加，所以谁在什么时候改了一段人格，没有被保留下来。

**Runtime invariant:** 不发布伴生检查。这个命名空间不拥有任何状态：它投影名册的回答，而那些记录由名册自己的 invariant 覆盖。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

无。

</details>
