---
description: "管理员读自己那些更改的历史所经过的那个界面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-admin-audit-controller

[English](README.md) | 中文

## 概述

`dsh-api-admin-audit-controller` 拥有 `audit` 这个 Remote 命名空间：一次读，答出某个身份可以看到的那些已记录的更改，最新的在前，带上每一次是谁做的，以及每个有差异字段的两边。谁可以读什么不由它决定——[`dsh-admin-audit`](../../identity/admin-audit/README.zh.md) 持有那条规则，这个命名空间把这次调用所处的身份交给它。它确实要解析的是：一次不点名的读指的是哪个组织——调用方自己的那个，这样租户管理员不必把自己唯一管理的那个组织往每次读里打一遍。

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

账户模块把它挂在它所代言的那份记录旁边：

```yaml
- id: admin-audit-controller
  name: '@deepseek-ai/dsh-api-admin-audit-controller'
```

配置界面读一页，或者读某一条记录自己的历史：

```ts
import type { AuditEntryView, AuditQueryInput } from '@deepseek-ai/dsh-api-admin-audit-controller/types'

/** The one read a history view makes. */
export interface HistoryView {
  readonly read: (query: AuditQueryInput) => Promise<readonly AuditEntryView[]>
}
```

每一次拒绝都带着它自己的码到达——`audit/not-permitted` 和 `audit/no-standing`——于是界面是把一页藏起来，而不是去匹配文字。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**权限是那份记录的。**点名一个组织就是要那个组织的记录；不点名就是要每一个组织的，而那只有平台身份管得到。把那条规则在这里再写一份，就多了一份要和第一份保持一致的东西，而且是直接调用方绕得过去的那一份。

**一次不点名的读指的是调用方自己的组织。**租户管理员正好持有一个，把它往每次读里打一遍，等于加一个只能填一个值的字段。平台身份不持有组织，所以不点名仍然是那次「每一个组织」的读——正是那份记录对别人已经拒绝的那个答案。

**一页靠游标续，不靠偏移量。**读者在翻页时那份记录还在被追加，所以 `before` 点名「从哪一条之后接着读」，下一页就还是下一页。用偏移量的话，只要两次读之间有管理员动过手，就会重复或漏掉一条。

**页的大小由部署钳住，不由调用方。**`limit` 是请求；那份记录最多答出部署所保留的那么多。要得比这多就是一页更短，而不是一次拒绝，于是界面不必知道那个上界才能发出一个有效请求。

**不是拒绝的那种失败，会以它自己的样子到达调用方。**只有那份记录自己的那个封闭原因被映射成一个码；一次存储失败不会被打扮成一次授权失败。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-admin-audit`](../../identity/admin-audit/README.zh.md) — 这个命名空间所读的那份记录，以及它把身份交给的那条规则。
- [`dsh-request-principal`](../../identity/request-principal/README.zh.md) — 一次调用所处的身份从哪里来。
- [`dsh-module-accounts`](../../bundle/module-accounts/README.zh.md) — 把它和那份记录一起选上的那份组合。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个包不注册任何工具或提示词：它通过 Remote 协议答出一次管理读取，它返回的东西不会进入任何模型请求。

#### KV Cache 影响

没有请求前缀发生变化，因为这里没有东西参与组装一个请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **只有一次读，只有一个方向** — `before` 往时间更早的方向续；没有范围、不能往回读，也不能按谁改的或改的是哪一类记录来筛。
- **不能导出** — 想把这份记录拿成一个文件的审计者，只能通过这个命名空间一页一页地读。
- **没有订阅** — 展示这份记录的界面靠重新读；没有东西告诉它来了一条新条目。

**Runtime invariant:** 不发布伴生检查。这个命名空间不持有自己的状态；每一个答案都是从那份记录自己的读投影出来的。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

`organizationOf` 被导出，是为了让这个命名空间唯一拥有的那一处解析可以单独测，而不是只能通过一个启动起来的部署去测。

</details>
