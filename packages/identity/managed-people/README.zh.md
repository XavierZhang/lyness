---
description: "部署的管理员在运行时维护的人员与准入绑定，叠加在 composition 写下的名册之上。"
kind: "package-reference"
---

# @lyness/lyn-managed-people

[English](README.md) | 中文

## 概述

`lyn-managed-people` 是一个部署跑起来之后，它的人从哪里来。composition 仍然写下第一个人——空系统里没有管理员来添加第一个管理员——此后每一个都通过界面添加：一个人、他的身份，以及被准入为他的那些目录身份。写下的那一半在每次查找中优先，并且不能在这里改动，因为下一次启动会重新读那个文件。它提供「带账户的部署」要问的两个问题的两端：`ctx.people` 说谁存在、各自能做什么，`ctx.signInAdmission` 说某个已验证的目录主体是其中的哪一个。

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

三行，替换静态名册与名册准入规则：

```yaml
- id: managed-people
  name: '@lyness/lyn-managed-people'
- id: people
  name: '@lyness/lyn-managed-people/directory'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
- id: sign-in-admission
  name: '@lyness/lyn-managed-people/admission'
  config:
    bindings: []
```

目录行与准入行读取的 `people` 与 `bindings` 配置，与它们的静态对应物完全相同，因此已经写好名册的安装原样保留，并获得往上添加的能力。名册仍必须至少写一个人：添加其余人的正是他。

管理员添加一个人，以及以他身份登录的目录身份：

```ts
import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-managed-people'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

const bea = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, by)
await ctx.managedPeople.bind({
  channel: 'b2f1c0de-0000-4000-8000-000000000000',
  issuer: 'ww-acme',
  subject: 'bea',
  person: bea.id,
}, by)
```

`list(by)` 回答该身份所管理的人，写下的与存储的一并给出，每个人都带上被准入为他的身份，以及这条记录是否由 composition 拥有。拒绝是一个带五种原因之一的 `PeopleRefusedError`，于是界面去标记字段或禁用某一行，而不是去匹配文案。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**两半共存，写下的那一半优先。** composition 每次启动都会被重新读取，因此一条遮盖了写下条目的存储条目，只在没人重启的那段时间里算数。对写下的人或绑定的修改以 `written` 被拒绝，而不是被接受然后悄悄回退。

**授予一个角色就是授予它能做的事。** 租户管理员不能造出平台管理员，因为那个身份管理每一个组织，包括他管不到的那些。一次修改既按提交内容授权，也按**已存储**的记录授权，否则一个租户的管理员只要用自己的组织报出另一个租户的人员 id，就能把人夺走。

**一条绑定由「人」与「渠道」共同授权。** 绑定到另一个组织的目录上，就让那个组织的人能在这里登录，因此渠道也必须是该身份所管理的；渠道归属读自已配置的渠道记录（当部署存储它们时）。不存储渠道的部署，授权就只看人。

**身份标识从不移动。** 成员身份 id 只由人的 id 推出，因此改变某人的角色不会改变一个已打开会话所记的成员身份 id——身份 id 移动了的会话会变成「没有身份」，而不是「换了身份」。

**人员 id 不复用。** 被移除的人连同他的 id 一起退场，于是他开过的对话仍归属于一个不再登录的人，而不会归到下一个被添加的人头上。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-people`](../people/README.zh.md) —— 它提供的目录，以及它读取的静态名册。
- [`lyn-sign-in`](../sign-in/README.zh.md) —— 它提供的准入规则，以及它读取的名册规则。
- [`lyn-sign-in-channels`](../sign-in-channels/README.zh.md) —— 绑定所指名的渠道。
- [`lyn-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 把这一切选上的那份 composition。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它决定谁可以使用一个部署，它存储的东西都不会进入模型请求。

#### KV Cache 影响

请求前缀不变，因为这里没有任何东西参与请求装配。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **一个人只有一个身份** —— 一个人属于一个组织、持一个角色，和写下的名册一直以来的做法相同；同时服务两个组织的人需要两个身份。
- **composition 渠道无法由租户管理员绑定** —— 渠道检查读的是已配置的渠道记录，来自 composition 行的渠道不在其中，因此只有渠道被存储的部署才能把绑定权下放。
- **没有自己的审计** —— 记录写明谁添加了这个人、何时添加，替换时保留两者；谁改了什么的历史不保存。
- **移除一个人不会结束他的会话** —— 他不能再登录，但已经建立的会话在过期前仍然有效。
- **没有任何东西阻止最后一个管理员被移除** —— 写下的名册就是恢复路径，这也是它不能被清空的另一个原因。

**Runtime invariant:** 不发布任何 companion。写下的那一半由读取配置的那些行声明进本服务，每次查找都只读那一张 map 与那一张存储表，因此「谁存在」不可能有两份会分歧的观察。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

目录行与准入行不持有状态：它们解析各自的配置，以 effect 的形式声明进来，于是一次重载恰好撤回这份 composition 声明的内容，然后把每次查找转发出去。优先级因此只有一处实现，这正是「写下的优先」不会变成两条可能互相矛盾的规则的原因。

</details>
