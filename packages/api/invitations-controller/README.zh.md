---
description: "管理员签发、读出与撤回邀请码，以及任何登录了的人接受一张邀请码的那个界面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-invitations-controller

[English](README.md) | 中文

## 概述

`dsh-api-invitations-controller` 拥有 `invitations` 这个 Remote 命名空间：一个标准管理着的那些邀请码，签发一张、撤回一张这两个调用，以及任何登录了的人用来接受一张的那个调用。谁可以签发什么它一概不决定——那些规则在 `dsh-invitations` 手里，这个命名空间只是把「这次调用所处的那个标准」交给它、并把它答出的东西汇报出来。码只过线一次，就在 `issue` 的应答里，因为部署只存它的哈希。其余每个应答携带的是：这张码授出什么、什么时候失效、还剩多少。

## 目录

- [使用这个包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未完成事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用这个包

账号模块把它与它所代言的那些邀请码挂在一起：

```yaml
- id: invitations-controller
  name: '@deepseek-ai/dsh-api-invitations-controller'
```

管理页签发一张、把码展示这一次，并拼出携带它的那条链接：

```ts
import type { InvitationInput, InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'

/** The one call an invitation form makes. */
interface InvitationsRemote {
  /** Issue one invitation, and answer the code once. */
  issue: (input: InvitationInput) => Promise<InvitationRowView>
}

/**
 * Issue one invitation and build the link to send.
 * @param remote - the `invitations` namespace, as the client reaches it.
 * @param input - the label, the standing, and the organization.
 * @param channel - the configured sign-in channel the person will use.
 * @returns the invitation, and the link that presents its code.
 * @throws {Error} when the answer carries no code, which no issue does.
 */
export async function invite(
  remote: InvitationsRemote,
  input: InvitationInput,
  channel: string,
): Promise<{ readonly invitation: InvitationRowView, readonly link: string }> {
  const invitation = await remote.issue(input)
  if (invitation.code === undefined) throw new Error('this issue answered no code')
  // The code is in this answer and nowhere else: show it now, or issue
  // another invitation later.
  const link = `/auth/sign-in/${encodeURIComponent(channel)}?invite=${encodeURIComponent(invitation.code)}`
  return { invitation, link }
}
```

链接点名的那个渠道，是 `signInChannels` 命名空间列出的那些已配置渠道之一，所以界面提供那份列表，而不是一个自由输入框。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**标准是解析出来的，不是假定的。** 一次调用只有在授权规则放它过去之后才到得了命名空间的方法上，而一个什么规则都不挂的部署会放过每一次调用。在这里解析标准、并以 `invitations/no-standing` 拒绝，使「一张能准入成员的码」不会在无人担责的情况下被签出去。

**码只答一次，之后再也读不回来。** `issue` 携带它；`list` 从不携带，因为库里只有哈希。界面丢了它就再签一张，而不是回来要这一张。

**每种拒绝都有自己的错误码。** `not-permitted`、`incomplete`、`out-of-bounds`、`unknown` 各自原样过线，于是表单能标出「组织」那一栏、能报出部署的上界、能把标准的事说清楚，而不必去匹配文案。

**`accept` 是这里唯一一个成员够得着的方法。** 其余每个方法都是管理员的；这一个存在的理由，是让「获得这个身份的人」就是「提出要求的那个人」。它加到哪个账户上，来自这次调用自己的会话，而不是一个参数——一次能自己点名人的接受，等于让任何登录了的人把身份加到别人头上。

**`accept` 对每一种拒绝只有一个答案。** 码不对、已用完、签发者已不再持有那个标准、以及授的是调用方已经持有的身份——全部读作 `accepted: false`。其余那些方法把拒绝分开汇报，是因为管理员能据此行动；而在这里，把它们区分开，等于让任何登录了的人得知哪些码存在、各自携带多大的授权。

**`revoke` 不是删除。** 它撤回那张码、保留那一行，因为「谁邀请了谁」正是留这条记录的意义；所以这个命名空间没有 `delete`。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-invitations`](../../identity/invitations/README.zh.md) —— 它所代言的那道接缝，以及它施加的每一条边界。
- [`dsh-api-people-controller`](../people-controller/README.zh.md) —— 一次兑换写进去的那本名册。
- [`dsh-api-sign-in-channel-controller`](../sign-in-channel-controller/README.zh.md) —— 邀请链接点名的那些渠道。
- [`dsh-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 把这一整套选进来的那个组合。

-----

<a id="model-experience"></a>
## 模型体验

无：这个包不注册任何工具或提示词，它是「谁可以加入一个部署」的配置界面，它答出的东西没有一样进入模型请求。

#### KV 缓存影响

不改变任何请求前缀，因为这里没有任何东西参与请求组装。

## 已知限制与未完成事项

<a id="known-limitations-and-deferred-work"></a>

- **接受说不出它为什么什么也没授出**：这正是它的要点，于是持有者只能去问发码给他的那个人。
- **没有任何东西负责把邀请发出去**：命名空间答出一张码，怎么送达是管理员自己的事，用他本来就在用的渠道。
- **没有分页**：`list` 把这个标准管理着的全部答出来，这适合一套安装的员工规模，而不适合一个每租户签出几千张的平台。
- **兑换不在这里汇报**：使用次数会动，但「谁兑换了哪张码」要从管理轨迹里读，不是从这个命名空间。

**运行期不变量：** 不发布任何 companion。这个命名空间自己不持有状态：每个应答都是在发问的那次调用上、从邀请码那道接缝投影出来的。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

命名空间上的 `requires: 'tenant-administrator'` 是 Gateway 那道粗门禁；按组织的那个判断属于接缝，并且在那里再做一遍——因为 Gateway 知道标准，却不知道一次提交点名的是哪个组织。

</details>
