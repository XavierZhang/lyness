---
description: "调用者是谁，以及这套部署会让他们用什么登录。"
kind: "package-reference"
---

# @lyness/lyn-api-identity-controller

[English](README.md) | 中文

## 概述

`lyn-api-identity-controller` 拥有 `identity` 这个 Remote 命名空间：一个答案同时携带这套部署有没有账户、调用者是谁、他们以什么身份行事，以及登录界面可以提供哪些渠道。它对任何人可读，因为最需要它的那个调用者还没有出示身份——界面在问清「有没有登录这回事」之前，渲染不出一块登录屏。登录与登出是 `lyn-sign-in-http` 拥有的浏览器跳转；本命名空间只说出它们在哪。

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

Web bundle 在每套部署上都挂它，无论有没有账户：

```yaml
- id: identity-controller
  name: '@lyness/lyn-api-identity-controller'
```

浏览器调用 `ctx.remote.identity.viewer()`，并把答案读作本包声明的视图：

```ts
import type { ViewerView } from '@lyness/lyn-api-identity-controller/types'

/**
 * Whether a surface should render a sign-in screen rather than the product.
 * @param view - what `identity/viewer` answered.
 * @returns true when this deployment has accounts and the viewer is not in one.
 */
export function mustSignIn(view: ViewerView): boolean {
  return view.accounts && view.person === undefined
}
```

提供一个渠道的方式是链接到 `${signInPrefix}/${channel.id}`，登出则链接到 `signOutPath`。两者都是跳转而非调用：一个要离开去目录自己的页面，另一个要清一个 cookie，都不可能发生在一次 RPC 里面。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**一个答案，不是两次调用。** 决定渲染什么的界面，需要在同一刻知道部署的形态与调用者的身份。分开问，就会先给一个必须登录的人渲染出产品，或者在一套根本没人可登录的安装上渲染出登录屏。

**决定 `accounts` 的是请求主体。** 一套挂了登录注册表却没挂主体的部署，永远无法对「谁登录了」做任何事；所以说出账户存在的是主体，而不是注册表。

**比人活得更久的会话读作未登录。** 主体点名了一个目录已不再持有的人；用一个有 id 没有名字的人作答，等于在每一页的角落里放一个幽灵。

**`anyone` 正是重点。** 其余每个命名空间都给调用者分类；而这一个的存在，就是为了在任何人被分类之前被读到，所以它声明那个唯一不要求身份的身份。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-sign-in`](../../identity/sign-in/README.zh.md) —— 它汇报的那个渠道注册表，以及它背后的准入规则。
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.zh.md) —— 这个答案里的路径所指向的那些路由。
- [`lyn-api-remote-authority`](../remote-authority/README.zh.md) —— 为什么 `anyone` 是一个声明，而不是一处缺席。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它回答的是一个正在决定渲染什么的界面，它汇报的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有任何东西据它把产品挡在门外** —— 答案说出了「这个访客必须登录」，而还没有界面会因此拒绝渲染。托管部署仍然把页面发给未登录的浏览器，再由 Remote 授权规则逐次调用地拒绝。
- **一个身份，而不是在多个之间选** —— 在两个组织都有身份的人，以其会话携带的那一个行事；本命名空间汇报那一个，而不提供其余的供选择。
- **没有渠道配置** —— 渠道属于组合；部署方或租户管理员无法从界面上增删或排序任何一个。
- **路径是这套部署自己的** —— 把 `lyn-sign-in-http` 挂在别的路由上的组合，这里仍会汇报默认路径，因为常量是导入来的，不是问来的。

**运行时不变量：** 不发布伴生检查。每个字段都在被问到的那一刻，从主体、目录与注册表投影而来，不存在第二份副本与它们发散。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

它读到的每个服务都是可选的（`ctx.get`），因为这个命名空间会挂在一个都没有的部署上；在这里加一个必需注入，会让单操作者安装答不出 `accounts: false`。

</details>
