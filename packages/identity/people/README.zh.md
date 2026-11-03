---
description: "人及其在组织中的身份：目录接缝、三个角色，以及由运营方书写的名册。"
kind: "package-reference"
---

# @lyness/lyn-people

[English](README.md) | 中文

## 概述

用 `lyn-people` 回答「调用方是谁、他的身份允许做什么」。一个人持有一个身份，而 **membership** 是他在某一个组织中的身份，恰好携带三个角色之一。`./static` 提供一份由运营方书写的名册，这是独立部署在接入 SSO 之前的目录。该目录只报告角色、不做任何授权：每个操作自己依据 `administers` 作决定。

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

一个由管理员维护名册的安装挂载静态 provider：

```yaml
- id: people
  name: '@lyness/lyn-people/static'
  config:
    people:
      - id: root
        displayName: Platform Root
        role: platform-administrator
      - id: ada
        displayName: Ada
        role: tenant-administrator
        organization: acme
      - id: bob
        displayName: Bob
        role: member
        organization: acme
```

只有名册点名的人才能使用那个安装，所以一个未知身份持有的是「没有身份」、而不是某个默认身份。`people` 是必填的、为空时被拒绝，而重复的 `id` 在加载时被拒绝。

一个把自己限制给管理员的操作去问那个判定，而不是比较角色：

```ts
import { administers } from '@lyness/lyn-people'
import type { Membership } from '@lyness/lyn-people'

declare const standing: Membership
declare const organization: string | undefined

if (!administers(standing, organization)) throw new Error('not permitted')
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

三个角色是 `platform-administrator`、`tenant-administrator`、`member`。只读审计员曾被考虑并延期：它会在任何东西需要它之前先添一个角色。

`administers` 的存在，是为了让任何调用点都不必记住「平台角色高于租户角色」。租户管理员管理它自己的组织、不管别的；平台管理员管理每一个组织，包括平台自身的上下文；成员什么都不管理，包括它自己所属的组织。

有两种形状在加载时就被拒绝，而不是留给某个界面。一个未知角色会无声地谁都不放进来；而一个不点名组织的租户管理员，会在读起来像管理员的同时什么都管理不了——那比被拒绝更糟。

该目录不做任何决定。一个身份是否可以执行某个操作，是那个操作自己的决定，依据的是被报告的角色——因为一个同时做授权的目录，会把所有规则放在一处、而没有一条在它被强制执行的地方。

-----

<a id="further-exploration"></a>
## 进一步探索

- [人、成员关系与调用所处的上下文](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md) —— 本包所实现的那个决定，包括一次调用要声明的 acting context。
- [`tenant-config`](../../tenant/tenant-config/README.zh.md) —— 管理员维护的那份按租户配置。
- [`lyn-model-policy`](../../llm/model-policy/README.zh.md) —— 第一个会把自己限制给管理员的操作。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它为宿主回答目录问题。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **静态名册给每个人恰好一个身份** —— 对一个只服务一个组织的安装而言这是对的，而这也正是托管部署需要一个由存储支撑的目录（一个人可以持有多个身份）的原因。
- **尚无 acting context** —— 那个决定定义了「一次调用要声明、而服务端要校验」的上下文；本包提供词汇与目录，不提供按调用的那层管道。
- **尚无 SSO 绑定** —— 一个接入 AD、企业微信、钉钉或飞书的独立部署安装，需要把一个外部账号绑定到某个身份；而名册是那条无论如何都保留的手工路径。

**Runtime invariant:** 不发布任何 companion。静态目录只持有运营方那份被冻结的名册，而这条接缝不拥有可变状态。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`administers` 就是本包全部的授权面，所以改动它会一次性改变每一个把自己限制给管理员的操作。增加第四个角色意味着回头审视它，而不是在每个调用点扩展一次角色比较。

</details>
