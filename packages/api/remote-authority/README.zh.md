---
description: "一次远程调用能不能被服务，在每个线上调用都要经过的那一处决定一次。"
kind: "package-reference"
---

# @lyness/lyn-api-remote-authority

[English](README.md) | 中文

## 概述

`lyn-api-remote-authority` 是那条规则：拒绝调用方身份到不了的远程调用。它监听网关的授权点——每个线上调用都要经过那里——把请求所处的身份与端点声明的要求比对：先看方法自己的要求，否则看它命名空间的。没有人分类过的端点被拒绝，而不是被放行。这一切是否适用，是一个组合选择：键盘前只有一个人的安装既不挂账户也不挂规则，没有任何东西会拒绝他们自己的机器。

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

`@lyness/lyn-module-accounts` 把它与目录、请求主体一并选中；自己写行的组合同样加上一行：

```yaml
- id: remote-authority
  name: '@lyness/lyn-api-remote-authority'
```

它不需要配置。每个端点要求什么，声明在那个端点所在之处——命名空间声明默认值，方法可以抬高或降低它：

```ts
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type { Context } from '@lyness/cordis'

declare const nothing: unique symbol

export class LedgerController extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'ledgerController', { namespace: 'ledger', requires: 'member' })
  }

  @Remote
  read(): string {
    return 'what a member may read'
  }

  @Remote({ requires: 'platform-administrator' })
  write(): string {
    return 'what only the deployment may change'
  }
}
```

命名空间一个都没声明时，`verify-remote-authority` 会让构建失败，于是新控制器不可能以「未分类」的状态发布。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**只有一处，因为只有一处的检查才靠得住。** 一个命名空间有多少方法就有多少入口，写在每个入口里的检查，就是下一个入口里被忘掉的检查。网关把每一次调用——来自浏览器、来自桌面客户端、来自直接 RPC——都解析到同一处，所以规则坐在那里，没有东西能绕过去。

**规则是插件，那一处不是。** 一套部署是否授权，取决于它有没有可比对的身份。于是网关负责问，本包负责答；没有账户的组合不挂任何答案，网关一如从前地服务。

**失败朝关闭的方向。** 命名空间与方法都没声明的端点被拒绝。放行它会让每个新方法默认公开——而那正是本包要终结的失败。门禁把这种拒绝挡在生产之外：把遗漏变成构建失败。

**`anyone` 最先被回答。** 一条登录路由，按定义就是由还没登录的人到达的，所以这条要求在解析任何身份之前就被满足。

**是身份，不是人。** `member` 只要求调用已签入——个人上下文也满足它。管理员级要求的是目录认得的一个身份，所以以个人上下文发起的调用会被拒绝，即使那个人在别处持有管理员身份：上下文就是声明，而被授权的是声明。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-gateway`](../gateway/README.zh.md) —— 它所搭乘的授权点，以及它产生的 `gateway/forbidden` 拒绝。
- [`lyn-people`](../../identity/people/README.zh.md) —— 身份，以及每种角色能做什么。
- [`lyn-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 选中它的那个组合。
- [离开单操作者 Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.zh.md) —— 共享运行时为什么需要它。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它在任何方法运行之前回答一次线上调用，而被拒绝的调用根本到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **管角色，不管行** —— 它回答一个身份能否调用某个操作，从不回答它能否碰某一条具体的会话、工作区或任务。一个成员读另一个成员的对话属于归属问题；归属人已被记下，但还没有任何东西按它过滤。
- **组织之间不分彼此** —— 某个组织的租户管理员，满足任何 `tenant-administrator` 端点，无论那次调用关于哪个组织。每个对组织行事的命名空间，仍需自己核对是哪一个，像 `lyn-credits` 那样。
- **声明按命名空间，不按部署** —— 想让自己成员去配置某项、而本仓库把它归为平台级的部署，无法从组合层面降低它。
- **拒绝文本会到达调用方** —— 它点出所要求的与所持有的身份，这等于告诉未授权的调用方这个端点存在。而端点列表本来就已经告诉他们了。
- **什么都不记录** —— 一次拒绝只是被回答，不被记下，所以部署还无法回顾谁曾被拦住。

**运行时不变量：** 不发布伴生检查。规则不持有状态：每个答案都在被问到的那一刻，由请求主体与目录计算出来。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

typert 分析器校验 `requires` 却什么都不留：该值经运行时标记抵达网关，所以新增一种身份要同时改 `RemoteAuthority`、分析器的 `REMOTE_AUTHORITIES`、本包的 `SATISFIES` 与 `verify-remote-authority`。

</details>
