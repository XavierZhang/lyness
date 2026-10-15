---
description: "解析并校验一次调用所处的上下文：由调用声明、由调用方持有、并被地址所允许。"
kind: "package-reference"
---

# @lyness/lyn-acting-context

[English](README.md) | 中文

## 概述

用 `lyn-acting-context` 判定一次调用所声明的上下文是否被允许。签入产生的是「人的会话」，不是「某个身份的会话」，所以哪个身份在生效是按调用决定的。三条规则各带一个 code 供界面映射成自己的文案：一次调用要么声明自己的上下文、要么被拒绝；所声明的身份属于调用方；而一个解析到某组织的地址只接纳那个组织的身份。

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

把它挂在一个人员目录旁边：

```yaml
- id: acting-context
  name: '@lyness/lyn-acting-context'
```

传输层在操作运行之前解析每次调用的声明：

```ts
import type { ActingContextResolver } from '@lyness/lyn-acting-context'
import type { PersonId } from '@lyness/lyn-people'

declare const resolver: ActingContextResolver
declare const signedInPerson: PersonId
declare const addressOrganization: string | undefined

const acting = await resolver.resolve({
  person: signedInPerson,
  declared: { kind: 'personal' },
  organization: addressOrganization,
})
```

一次拒绝是一个 `ActingContextRefused`，携带四个 code 之一：`context-absent`、`membership-unknown`、`membership-not-held`、`context-outside-address`。

-----

<a id="understand-the-implementation"></a>
## 理解实现

`DeclaredContext` 把个人上下文做成一个值、而不是一种缺席，于是「什么都没声明」与「声明了个人上下文」是两种不同的输入。这正是「缺席那种情形无法靠漏写一个字段而到达」的全部原因：一个持有两个身份的人会让默认值变成一次猜测，而这里猜错就是把一段对话归属给了错误的组织。

地址约束上下文，而从不选择它。一个属于某组织的地址会拒绝任何其他上下文，而不是无声地切换进那个组织——这样一个人永远知道自己的工作被归属给了谁。

一个由他人持有的身份被报告为 `membership-not-held` 而不是 `membership-unknown`，因为调用方不应当借此得知「别人的身份是否存在」。

这项检查只住在这里、不在别处。放在传输层或界面里的检查会被下一个调用方绕过，而在多处重复的检查终将自相矛盾。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-people`](../people/README.zh.md) —— 本解析器询问的那个目录，以及三个角色。
- [人、成员关系与调用所处的上下文](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md) —— 本包所实现的那个决定。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它为宿主回答一个授权问题。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **它只校验一次声明、不存储任何东西** —— 记住「当前生效的上下文」的那份会话侧状态，以及改变它的那次显式切换，属于认证会话而不属于这里。
- **地址所属组织是一个入参，不是一次查找** —— 把主机名或网关头解析成组织的那一方把结果传进来；本包从不自己解析它，因此也不可能被诱导去信任一个自己读到的头。
- **拒绝没有审计** —— 一次被拒绝的上下文只留下一个错误、没有记录，所以一个要排查「反复被拒」的部署目前无可读之物。

**Runtime invariant:** 不发布任何 companion。该解析器不持有状态；每个答案都是「声明」与「目录」的函数。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

那处刻意的不对称是：`organization` 作为参数到达。一个将来自己去解析主机名的版本，就必须决定是否信任 `x-tenant-id`——而那个决定被笔记指派给了部署的边缘；把它保持为参数，就把那个决定留在本包之外。

</details>
