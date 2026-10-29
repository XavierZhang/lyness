---
description: "一个人的 agent 可以用什么，以及每一项是谁决定的。"
kind: "package-reference"
---

# @lyness/lyn-api-agent-capabilities-controller

[English](README.md) | 中文

## 概述

`lyn-api-agent-capabilities-controller` 持有 `agentCapabilities` 这个 Remote 命名空间：一次读取回答一个人的对话此刻真正拥有哪些工具、MCP 连接与 skill，每一项说明是部署还是 agent 预设提供的。所有答案都在被问的那一刻从 agent 自己读的那些注册表投影出来，所以这个命名空间不持有自己的清单，也不可能与 agent 真正拥有的东西产生分歧。

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

把它挂在工具注册表所在的位置；预设与 skill 注册表是可选的：

```yaml
- id: agent-capabilities-controller
  name: '@lyness/lyn-api-agent-capabilities-controller'
```

`describe()` 回答可用的工具、连接与 skill，并说出它所读的那个预设。模型不在这里：`session.modelCatalog` 已经回答这个部署路由哪些模型，界面从那里取。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它不持有清单。** 每次调用都重新读 `ctx.tools.definitions()` 与 `ctx.skills.list()`。在这里存一份清单，就是关于能力的第二个答案，而组合第一次变化时它就会与 agent 产生分歧。

**读取会取得预设自己的作用域。** `agentPresets.acquireScope()` 交回一个修订租约，于是汇报的是「该预设的一个 agent 会看到的视图」，而不是部署的裸注册。读取抛错时租约同样被释放，因为它是一个阻止预设世代被回收的 retain。

**一项能力是谁给的，是算出来的，不是存下来的。** 工具注册不携带注册方，所以答案来自把预设视图与部署全局视图相比：两者都有即部署，只有作用域里有即预设。

**一个 MCP 服务器是一个连接，不是四个工具。** `lyn-mcp-client` 把每个工具命名为 `mcp__<server>__<raw>`，于是服务器名从名字里读出来、它的工具只计数不罗列；一个要判断「我是否能触达某个系统」的读者，在意的是那个系统。

**缺失的注册表被如实汇报为缺失。** 没有挂载 skill 注册表的部署根本不会得到 `skills` 这个成员，界面把它读作「这套安装没有 skill」，而不是「它什么都没发现」。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-client-ui-settings-capabilities`](../../client/ui-settings-capabilities/README.zh.md)：调用它的那张页面。
- [`lyn-tools`](../../core/tools/README.zh.md)：本包投影其作用域视图的那个注册表。
- [`lyn-skill`](../../skill/skill/README.zh.md)：本包汇报其 `source` 与 `provider` 的那个目录。
- [`lyn-mcp-client`](../../mcp/mcp-client/README.zh.md)：把工具按服务器命名的地方。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它汇报的是面向模型的注册表已经持有的内容，而每个注册表各自负责自己的贡献如何进入请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何内容参与请求组装。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **不反映 agent 级的限制**：`tools.restrict()` 作用在某个 agent 自己的作用域上，而这次读取没有 agent，所以一段正在运行的对话给自己禁掉的工具在这里仍会出现。
- **只有默认那一个预设**：按会话自行切换预设的读者看到的是部署的默认预设，而不是他切到的那一个。
- **归属是一次比较，不是一个存下来的注册方**：部署与预设都注册过的工具读作部署的，因为两份视图本就分不出这种情况。
- **连接只给计数，不给它的工具**：读者不问 agent 就看不到某个服务器提供哪四个动作。

**运行期不变量：** 调用之间不保留任何状态；为一次读取取得的租约在返回之前释放。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

预设与 skill 注册表用 `ctx.get` 读，而不是写进 `inject`，于是两个都没挂的组合仍然用它唯一拥有的视图服务这个命名空间。

</details>
