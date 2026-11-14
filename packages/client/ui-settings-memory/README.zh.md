---
description: "设置里的记忆分区：这个部署关于一个人记住了什么。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-memory

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-memory` 是个人平面的记忆页：这个部署关于读它的那个人记住的每一条事实各占一行，写明记于何时，并有一个按钮把它忘掉。它只读与删，不提供写入，因为一条记忆是在一个人请求 agent 记住某件事时写下的——他真正想说的那句话属于那里。这个部署的共享记忆属于管理员，不在这里列出。

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

Web bundle 挂上它；它所读的命名空间随记忆模块一起到来：

```yaml
- id: ui-settings-memory
  name: '@lyness/lyn-client-ui-settings-memory'
```

别的都不用配。分区注入 `remote.memories`，所以不选记忆模块的部署根本不显示记忆页，而不是显示一张空页。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**只读与删，不提供写入。** 这里放一个输入框，等于邀请一条没有人在对话里说过的事实，而会话日志解释不了它从哪来。

**剩下什么来自答复，而不是来自被点的那一行。** 删除会汇报整份剩余列表，于是一行若本已不存在就直接消失，而不是继续留着；页面也永远不会显示部署并不持有的列表。

**一次只删一条。** 一次删除进行中时所有按钮都被禁用，而只有它自己那一行说明情况——这正是防止第二次点击删掉「在手下移动过的那一行」的办法。

**读取在分区打开时开始，而不是在插件加载时。** 从不打开这里的人，不让部署付出一次请求。

**「什么都不拥有的调用」与「没有任何记忆的人」被区分开。** 前者没有可读的内容，就这么说；后者是普通的空状态，它邀请这个人去让 agent 记住点什么。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-memory-controller`](../../api/memory-controller/README.zh.md)：本页读写的那个命名空间。
- [`lyn-memory`](../../memory/memory/README.zh.md)：它背后的存储，以及一个 agent 看到什么。
- [`lyn-client-ui-settings`](../ui-settings/README.zh.md)：两个分区平面槽位的声明处。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它为一个人列出已存记录，而一条记住的事实如何进入模型请求由 `lyn-memory` 负责。

#### KV 缓存影响

本页不改变请求前缀；忘掉一条事实改变的是那个人下一次组装所携带的内容，这由 `lyn-memory` 描述。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有确认步骤**：忘掉只需一次点击且无法撤销；这些事实都很短，重新记住一条就是对话里的一句话。
- **没有搜索与分页**：每一条都列出来，其上限由存储自己的保留策略决定，而不是由这张页面决定。
- **没有东西说明是哪段对话写下的事实**：存储保留的是「何时」而不是「何处」，所以一个人无法把一条记忆追回到产生它的那次交流。

**运行期不变量：** 页面渲染的正是部署回答的那些条目，发送的只是它自己渲染过的 id。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

删除状态存的是一个 id 而不是布尔值，于是正在被删的那一行可以说明情况，其余各行只是安静下来；布尔值会把同一句标签贴到每一行上。

</details>
