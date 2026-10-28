---
description: "管理员在运行时维护「谁可以使用这个部署」的那个界面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-people-controller

[English](README.md) | 中文

## 概述

`dsh-api-people-controller` 拥有 `people` Remote 命名空间：某个身份所管理的人，以及添加一个人、修改一个人、移除一个人、准入或撤回以他身份登录的目录身份这些调用。谁能改什么不在这里决定——那些规则由 `dsh-managed-people` 持有，本命名空间把这次调用所处的身份交给它，并汇报它的回答。每一行都说明它是否由 composition 拥有，于是界面会禁用自己改不了的东西，而不是给出一个下次启动就会被回退的编辑入口。

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

账户模块把它挂在它所代言的目录旁边：

```yaml
- id: people-controller
  name: '@deepseek-ai/dsh-api-people-controller'
```

配置界面先列出自己能改的人，然后添加一个人，并说明他是哪个目录身份：

```ts
import type { BindingInput, PersonInput, PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'

/** The two calls one person form makes. */
interface PeopleRemote {
  /** Add one person, or change one this deployment maintains. */
  save: (input: PersonInput) => Promise<PersonRowView>
  /** Admit one directory identity as one person. */
  bind: (input: BindingInput) => Promise<void>
}

/**
 * Add one colleague and say which directory identity they are.
 * @param remote - the `people` namespace, as the client reaches it.
 * @param input - the name, the standing, and the organization.
 * @param identity - the channel, issuer and subject that authenticate them.
 * @returns the person as the deployment now reads them.
 */
export async function admit(
  remote: PeopleRemote,
  input: PersonInput,
  identity: Omit<BindingInput, 'person'>,
): Promise<PersonRowView> {
  const added = await remote.save(input)
  // Adding somebody admits nobody: until an identity is bound to them, the
  // sign-in page refuses them.
  await remote.bind({ ...identity, person: added.id })
  return added
}
```

绑定所指名的渠道是 `signInChannels` 命名空间列出的那些已配置渠道之一，因此界面提供那份列表，而不是一个自由输入框。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**身份是解析出来的，不是假定的。** 一次调用只有在权限规则放行后才会到达命名空间方法，而不挂载该规则的部署会放行每一次调用。在这里解析身份、并以 `people/no-standing` 拒绝，才能避免「谁可以使用这个系统」被一次无人负责的调用改掉。

**每种拒绝都有自己的错误码。** `written`、`not-permitted`、`unknown-person`、`already-bound` 与 `incomplete` 各自原样过线，于是表单可以禁用某一行、标出某个字段，或者说明身份不对，而不必去匹配文案。

**绑定自己不回答任何东西。** `bind` 与 `unbind` 不返回值：界面渲染的是人员行，而 `list` 与 `save` 已经带着它的绑定一起给出；这一个事实只有一个来源，正是这一点让界面不会同时显示两份。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-managed-people`](../../identity/managed-people/README.zh.md) —— 它所代言的目录，以及它施加的每条规则。
- [`dsh-api-sign-in-channel-controller`](../sign-in-channel-controller/README.zh.md) —— 绑定所指名的渠道。
- [`dsh-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 把这一切选上的那份 composition。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它是「谁可以使用这个部署」的配置界面，它回答的东西都不会进入模型请求。

#### KV Cache 影响

请求前缀不变，因为这里没有任何东西参与请求装配。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **目录身份是手输的，不是搜出来的** —— issuer 与 subject 需要手工填写，因为没有任何渠道种类提供目录搜索；填错的结果是谁都进不来，而不是错的人进来。
- **没有分页** —— `list` 回答该身份管理的全部人员，适合一个安装的员工规模，不适合每个租户上千人的平台。
- **没有东西说明某人为什么登录不进来** —— 一个没有绑定的人，和一个绑定指向已删除渠道的人，在这里看起来一样。

**Runtime invariant:** 不发布任何 companion。本命名空间不持有自己的状态：每个回答都是在发问的那次调用上从被管理的目录投影出来的。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

命名空间上的 `requires: 'tenant-administrator'` 是 Gateway 的粗粒度闸门；按组织的那次判断属于目录本身，并在那里再做一次，因为 Gateway 知道身份，却不知道一次调用指名的是哪个人。

</details>
