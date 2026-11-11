---
description: "邀请链接打开的那一页：它让人加入什么，以及用哪些目录兑换它。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-join

[English](README.md) | 中文

## 概述

`lyn-client-ui-join` 是邀请链接打开的那一页。它只在自己那条路径上占住内建的 `root` 席位、别处一行都不注册——因为跟着这种链接来的人在这里还没有账号，而工作台对他来说是一个用不了的产品。它从自己的查询串里读出那张码，为每一个「浏览器能发起的目录」各给一条已经带着码的链接，并且**不向部署打听这张码本身**。另有三种访问只会得到一句话：链接没带码、部署没有账号体系、以及人已经登录了。

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

两行，再加一行必须与它们一致：

```yaml
- id: web-runtime
  name: '@lyness/lyn-web-app'
  config:
    documentPaths:
      - /join
- id: ui-join
  name: '@lyness/lyn-client-ui-join'
  config:
    path: /join
- id: ui-admin-invitations
  name: '@lyness/lyn-client-ui-admin-invitations'
  config:
    joinPath: /join
```

同一个决定说了三遍：Host 决定哪些路径给出页面，`path` 决定其中哪一条承载邀请，`joinPath` 是管理页拼链接用的那个。三者不一致，链接就落在一条 404、或者渲染出工作台的路径上。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它什么都不向码打听。** 这一页从不调用部署，所以这里根本没有「这张码存不存在」的答案——一个谁都能打开的页面不该回答它。它把浏览器送去的那个登录流程才是出示码的地方，而那里的拒绝，读起来与任何一个未被准入的主体一模一样。

**码只到得了链接上。** 它从 `location.search` 读一次，被编码进每个渠道的 href；没有任何东西把它写到别处，而把它放进一只短命 cookie 以跨过目录往返的，是登录那条路由。

**只给浏览器能发起的那些目录。** 自驱动渠道是在拥有浏览器的那个进程里完成的，页面发起不了；把它摆出来就是一条什么都不做的链接。

**三种访问没有可兑换的东西。** 没带码的链接、没有账号体系的部署（它服务的是坐在键盘前的那个人，没有谁需要被准入）、以及已经登录的人（名册本来就认识他）。每一种各给一句话，而不是摆出一页注定失效的链接。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-client-ui-admin-invitations`](../ui-admin-invitations/README.zh.md) —— 这一页所应答的那条链接是在哪里拼出来的。
- [`lyn-invitations`](../../identity/invitations/README.zh.md) —— 一次兑换被拿去对照的那些边界。
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.zh.md) —— 让码跨过目录往返的那条路由。
- [`lyn-host-frontend-static`](../../host/frontend-static/README.zh.md) —— 让这条路径根本能给出一页的那个东西。

-----

<a id="model-experience"></a>
## 模型体验

无：这个包不注册任何工具或提示词，它是一个「在谁都还没有账号之前」展示的浏览器页面，它渲染的东西没有一样进入模型请求。

#### KV 缓存影响

不改变任何请求前缀，因为这里没有任何东西参与请求组装。

## 已知限制与未完成事项

<a id="known-limitations-and-deferred-work"></a>

- **它说不出「这张码已过期」**：能把好码与用完的码区分开的页面，会把这件事告诉任何人，所以被拒的兑换读起来就是登录处一次普通的拒绝。
- **它不说是谁邀请的、邀请去哪里**：码携带一个标准，把它显示出来就等于在一个谁都能打开的页面上读出那张邀请。
- **不支持自驱动目录**：浏览器发起不了的渠道不会被摆出来，所以这种部署的邀请得换别的办法兑换。
- **一次访问一张码**：这一页只读一个查询参数；手里有两张邀请的人打开两条链接。

**运行期不变量：** 这一页不向部署发出任何调用；它读到的那张码只出现在它渲染出的那些 href 里。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

把「有账号体系」与「单操作者形态」区分开的，是那次 viewer 读取，而它也是这一页执行的唯一一次读取：没有 `uiViewer` 时这一页报「没有账号体系」而不是去猜，因为一个不含那个服务的组合里，根本没有名册可供一次兑换写入。

</details>
