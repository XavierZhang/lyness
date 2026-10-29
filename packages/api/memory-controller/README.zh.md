---
description: "这个部署关于一个人记住了什么，只由本人读取与删除。"
kind: "package-reference"
---

# @lyness/lyn-api-memory-controller

[English](README.md) | 中文

## 概述

`lyn-api-memory-controller` 持有 `memories` 这个 Remote 命名空间：两个方法，读取这个部署关于调用方记住了什么，以及删掉其中一条。一次调用作用在谁的记忆上，从来不是一个参数——由存储从调用方发布的身份推出——于是持有别人 id 的调用方什么都删不掉。这个部署的共享记忆不在这里服务：它们不是某一个人该审阅的，而把它们列在某人自己的条目旁边，等于邀请一次把事实从所有人那里拿走的删除。

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

把它与它所读的存储挂在一起，这正是记忆模块的做法：

```yaml
- id: memory
  name: '@lyness/lyn-memory'
- id: memory-controller
  name: '@lyness/lyn-api-memory-controller'
```

`list()` 回答调用方自己的条目，最旧在前；`forget(id)` 删掉一条并回答剩下什么。不选记忆模块的部署不服务这个命名空间，而注入它的那张设置页也就不出现。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**这个命名空间要求一个部署认识的调用方。** 它声明的身份是 `member`，这一级准入任何有身份的人，不要求组织内的身份——关于一个人记住了什么属于那个人，而不属于某个组织的成员。

**没有方法接受「人」这个参数。** 两个方法都从请求身份推出 owner，于是线上不存在调用方可以改动来碰到另一个人记录的东西。

**删除由存储对着那个 owner 校验，而不是在这里。** `forgetOwnedBy` 同时接受 owner 与 id，于是属于别人的 id 匹配不到任何记录。本命名空间通过回读剩下什么来汇报结果，而不是信任那次删除。

**`list` 把「什么都不拥有的调用」与「没有任何记忆的人」区分开。** `owned: false` 是有账号体系却未出示身份的调用；页面会这么说，而不是给一个读起来像「关于你什么都没记」的空列表。

**没有账号体系的部署在这里什么都不拥有。** 它不把任何记忆归属给谁，所以它持有的每一条都是这个部署的；本命名空间不服务其中任何一条，它唯一的操作者通过 agent 自己的工具审阅它们。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-memory`](../../memory/memory/README.zh.md)：存储、分区，以及一个 agent 看到什么。
- [`lyn-client-ui-settings-memory`](../../client/ui-settings-memory/README.zh.md)：调用这两个方法的那张页面。
- [`lyn-api-remote-authority`](../remote-authority/README.zh.md)：执行本命名空间所声明身份的地方。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它服务的是一个读自己记录的人，而一条记住的事实如何进入模型请求由 `lyn-memory` 负责。

#### KV 缓存影响

调用时请求前缀不变；删掉一条记忆改变的是那个人下一次组装所携带的内容，这由 `lyn-memory` 描述。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **不提供写入**：一条记忆是在一个人请求 agent 记住某件事时写下的，他真正想说的那句话属于那里；本命名空间不提供添加的办法。
- **不包含共享条目**：这个部署为所有人保留的内容不列出，所以一个人分不清「关于他的共享事实」与「没有人记录过」。
- **没有管理员视图**：通过这个命名空间谁都读不到别人的记忆，管理员也不行，因为 owner 是推导出来的而不是指定的。

**运行期不变量：** 每个方法都作用于身份自己的 owner key，不作用于调用方提供的任何东西。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

`forget` 回答的是列表而不是布尔值，于是页面永远不必判断一次被拒的删除意味着「已经没了」还是「不是你的」：两种情况它都渲染这个部署当前持有的内容。

</details>
