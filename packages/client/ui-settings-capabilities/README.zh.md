---
description: "设置里的「可以用什么」分区：一个读者的模型、连接、skill 与工具。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-capabilities

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-capabilities` 是个人平面的只读入口：四组内容——模型、连接、skill、工具——列出这个读者的对话此刻真正拥有什么，每一行说明是部署还是 agent 预设提供的，并以一行话收尾：这里没有一项是他能改的。它是「模型」「插件」「Agent 预设」「连接」四张页面原本用一条拒绝提示来回答的那个问题的唯一答案。

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

Web bundle 把它挂在它所读的命名空间旁边：

```yaml
- id: agent-capabilities-controller
  name: '@lyness/lyn-api-agent-capabilities-controller'
- id: ui-settings-capabilities
  name: '@lyness/lyn-client-ui-settings-capabilities'
```

别的都不用配。分区排在个人平面最后，位于那些他确实能控制的条目之后。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**刻意只读。** 在这个产品里，这四样东西由部署组合而成，所以这里放一个控件等于承诺下一次调用会拒绝的事。改为说出「谁决定的」，才是同一张页面的诚实版本，而且不需要任何新权限。

**两个命名空间，一张页面。** 模型来自 `session.modelCatalog`——它本来就为模型选择器回答这件事；其余来自 `agentCapabilities`。从第二个来源再显示一遍模型，等于邀请两个答案发生漂移。

**模型清单坏掉不会拖垮整页。** 只有能力读取决定这页有没有答案：供应商清单出问题的部署，仍然有值得读的工具与 skill；模型会被省掉并附一行说明，而不是显示成「没有」。

**「这一组不存在」与「这一组是空的」读起来不同。** 「这个部署没有挂载 skill 注册表」与「没有发现任何 skill」是两句话，因为一个要判断自己能用什么的读者，需要知道自己看到的是哪一种。

**读取在分区打开时开始。** 从不打开这里的人不让部署付出一次请求，打开两次也只付一次。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-agent-capabilities-controller`](../../api/agent-capabilities-controller/README.zh.md)：本页所读的那个命名空间。
- [`lyn-api-session-controller`](../../api/session-controller/README.zh.md)：模型清单的来源。
- [`lyn-client-ui-settings`](../ui-settings/README.zh.md)：两个分区平面槽位的声明处。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它只是把面向模型的注册表已经持有的内容列给人看。

#### KV 缓存影响

请求前缀不变，因为这里没有任何内容参与请求组装。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **它描述的是默认预设，而不是打开着的那段对话**：在会话里切过预设的读者看到的是部署默认预设所拥有的东西。
- **行里没有通往决定者的链接**：一行用文字说「本部署」或「你的 agent 预设」，但不会打开管理员改它的那张页面，因为 member 本来就到不了那些页面。
- **连接只显示计数**：不列出该服务器自己的工具名，所以读者无法在这里审计它能做什么。
- **面板开着时不会刷新**：读取按每次打开进行一次，底下变化过的组合会在下次打开时显示。

**运行期不变量：** 每一行都来自为这次打开所做的读取；页面不持有自己的目录。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

模型按供应商加计数列出，而不是逐个模型列出：逐个模型是模型选择器的职责，在这里重复一遍会让这张页面成为「模型名必须正确」的第二个地方。

</details>
