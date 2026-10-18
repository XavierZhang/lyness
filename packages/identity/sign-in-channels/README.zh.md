---
description: "一套部署所服务的、已配置的登录渠道，由它的管理员存下的记录挂载而来。"
kind: "package-reference"
---

# @lyness/lyn-sign-in-channels

[English](README.md) | 中文

## 概述

`lyn-sign-in-channels` 是在没有人去改组合文件时，一套部署的登录渠道的来源。管理员点一个种类、填上那个目录需要的东西、提交应用密钥；记录被存下，密钥以一个别人点不到的引用进入凭据存储，一个渠道随之挂上。平台管理员配置部署自己的渠道；租户管理员配置本组织的、且只有本组织的，而每个组织的登录页只提供自己的那些。组合期的行仍然照常工作：两者注册进同一个注册表。

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

与注册表、以及这套部署允许的那些种类并列：

```yaml
- id: sign-in-kinds
  name: '@lyness/lyn-sign-in/kinds'
- id: sign-in-channels
  name: '@lyness/lyn-sign-in-channels'
- id: sign-in-kind-wecom
  name: '@lyness/lyn-wecom/kind'
```

一个种类行自己什么都不配置——它只说出那个目录需要什么。实例由管理员添加：

```ts
import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-sign-in-channels'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.signInChannels.save({
  kind: 'wecom',
  displayName: 'Acme 企业微信',
  organization: 'acme',
  settings: { corpId: 'ww-acme', agentId: '1000002' },
  secret: 'the application secret',
}, by)
```

替换一个渠道会保留它的 id，于是写在它上面的准入绑定仍然匹配。替换时不带 `secret` 则保留已存的那个——这正是「改个名字而不必重打一个读不回来的密钥」的做法。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**种类是形状，实例是决定。** 说某个目录协议的那个包，知道一个实例需要什么、怎么把它建出来；它永远不知道一套部署有几个、分别属于谁。于是加一个客户是加一条记录，而不是一次重新部署。

**授权用的是目录自己的那条规则。** 由 `administers` 决定：平台管理员够得着一切，包括部署自己的渠道；租户管理员只够得着本组织的。替换既按提交的内容授权，也按**已存的**内容授权，否则一个租户的管理员可以用自己的组织去点另一个租户渠道的 id，把它据为己有。

**密钥的引用是派生的，不是提交的。** 它来自渠道自己生成的 id。能够自己命名引用的管理员，可以把新渠道指向部署已有的凭据，或者把它覆盖掉。

**记录比建它的插件活得久。** 没有插件提供的种类、或被那个种类拒绝的设置，都让记录留着且不挂载。因为插件离开组合就把它删掉，会丢掉这套部署在插件回来时需要的配置；而界面上显示 `mounted: false` 是诚实的汇报。

**别人组织的渠道不是被拒绝，而是根本不列出。** 列出来再拒绝登录，等于告诉一个客户另外那些客户是谁。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-sign-in`](../sign-in/README.zh.md) —— 它们挂进去的那个注册表，以及种类注册表。
- [`lyn-wecom`](../../vendor/wecom/README.md)、[`lyn-dingtalk`](../../vendor/dingtalk/README.md) 与 [`lyn-feishu`](../../vendor/feishu/README.md) —— 一套部署可以被配置成的那些种类。
- [`lyn-credentials`](../../credentials/credentials/README.zh.md) —— 每个实例的密钥存在哪。
- [`lyn-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 把这一切选中的那个组合。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它配置的是人怎么登录，它存下的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有东西说明一条记录为何挂不上** —— `mounted: false` 汇报的是「种类拒绝了它的设置」或「没有插件提供这个种类」，却不说是哪一种、哪里不对。
- **一个渠道只属于一个组织** —— 要么属于部署，要么恰好属于一个组织；想把一个目录提供给自己客户中指定的一部分的平台，没有办法表达。
- **准入绑定仍在组合期** —— 管理员可以在运行时加一个渠道，却还不能说它准入谁；所以新渠道在名册被改之前签不进任何人。
- **它自己不留审计** —— 记录点出是谁在何时配置的，而一次替换把两者都覆盖；谁改过什么的历史没有保留。
- **删渠道不会删它的绑定** —— 点名过它的名册条目会留着、匹配不到任何东西，直到有人去删。

**运行时不变量：** 不发布伴生检查。已挂载的渠道完全由本服务从已存记录派生，而 `mounted` 读的就是持有它们 disposer 的那张表。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

服务在它的域一打开就挂载已存的渠道，而不是等第一次读取，于是一套部署的渠道在任何人登录之前就在服务了；先落地的 teardown 会在这项工作底下关掉那个域，那是关停而不是故障。

</details>
