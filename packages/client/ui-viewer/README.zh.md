---
description: "共享的 viewer 读取：谁登录了，以及这个身份会被提供哪些设置平面。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-viewer

[English](README.md) | 中文

## 概述

`lyn-client-ui-viewer` 持有浏览器端「谁在看」的唯一答案。它读一次 `remote.identity` 的 viewer，把这次读取共享给所有来问的界面，并发布一份快照：读取所处的状态、viewer 本身，以及管理平面是否属于他。它自己不渲染任何东西——登录页、账户行、设置导航的平面切分都读这份快照，所以它们不会向部署问三次，也不会显示三个互相矛盾的答案。

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

把它挂在它要读的命名空间旁边，排在消费它的界面之前：

```yaml
- id: identity-controller
  name: '@lyness/lyn-api-identity-controller'
- id: ui-viewer
  name: '@lyness/lyn-client-ui-viewer'
```

一个界面在自己的 `inject` 里声明 `uiViewer`，把 `ctx.uiViewer.state` 以 `viewer` 之名交给槽位注册的 `hooks` 隔间，并在挂载时调用 `ctx.uiViewer.load()`；它的组件随后通过框架生成的 `useViewer` 钩子从快照里取值。可能运行在没有目录的组合里的界面，用 `ctx.get('uiViewer')` 读这个服务，并自行决定「它不存在」意味着什么——设置外壳在无人作答时提供全部平面。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**一次读取，不论多少界面。** 在读取进行中到来的调用者会并入这一次；在它结束之后到来的调用者会发起新的一次。失败后想要一个新答案的界面调用 `retry`，它先丢掉上一次的结果，于是读者看到的是这次尝试，而不是它所替换的那次失败。

**平面在答案落地处推导，而不是在每个读者处。** `administers` 由读取返回的 viewer 计算一次，并随同一份快照发布，于是两个界面不可能对「这个身份被提供哪些平面」产生分歧。

**三种产品形态各自以自己的方式回答这个问题。** 没有账号体系的部署属于管理方——没有人登录，也没有人会被拒绝，收起这些页面等于把运维自己的页面藏起来不给唯一拥有它们的人。高于 `member` 的身份属于管理方。member，以及完全不持有身份的个人上下文，都不属于。

**读取失败会重新收起这个平面。** 上一个 viewer 随失败一起丢弃，因为基于「当前没有任何东西支撑的答案」渲染出来的平面，正是下一次调用可能拒绝的平面。

**这个切分是导航，永远不是授权。** 每个管理类调用都保留自己的检查，所以这里读错只会改变一个人被提供什么，而不会改变他可以做什么。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-identity-controller`](../../api/identity-controller/README.zh.md)：这个服务读取的命名空间。
- [`lyn-client-ui-sign-in`](../ui-sign-in/README.zh.md)：渲染这份快照的登录页与账户行。
- [`lyn-client-ui-settings`](../ui-settings/README.zh.md)：两个分区平面槽位的声明处。
- [`lyn-api-remote-authority`](../../api/remote-authority/README.zh.md)：真正拒绝身份不足的调用的地方。

-----

<a id="model-experience"></a>
## 模型体验

无。这个包不注册任何工具或提示词：它回答的是「浏览器前面是谁」，它发布的内容不会进入模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何内容参与请求组装。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **它不会自行刷新**：答案是在某个界面来问时读的，所以在另一个标签页里失效的会话，在有人再问之前仍读作有效。
- **没有身份可选**：一个人同时在两个组织里持有身份时，报告的是会话所携带的那一个，平面切分也随这一个走。
- **刷新之间不做缓存**：每次页面加载都重新读，因为目录变更之后再读一个存下来的身份，会用「当前没有人持有的事实」决定平面。

**运行期不变量：** 每个客户端上下文一个服务实例，同一时刻至多一次读取；所有界面读到的是同一个快照对象。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

这个服务把读取当作构造参数接进来，而不是自己调 `ctx.remote`，于是测试可以不搭传输层就驱动完整的服务——状态、共享、推导出的平面。

</details>
