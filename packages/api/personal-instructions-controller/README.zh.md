---
description: "一个人告诉自己 agent 的话，只由本人读写。"
kind: "package-reference"
---

# @lyness/lyn-api-personal-instructions-controller

[English](README.md) | 中文

## 概述

`lyn-api-personal-instructions-controller` 持有 `personalInstructions` 这个 Remote 命名空间：两个方法读取与替换调用方自己的指令，并给出这个部署接受的上限。一次调用作用在谁身上，从来不是一个参数——由存储从调用方发布的身份推出——于是调用方无法通过「问」来碰到别人的记录。

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

把它挂在它所读的存储旁边：

```yaml
- id: personal-instructions
  name: '@lyness/lyn-personal-instructions'
- id: personal-instructions-controller
  name: '@lyness/lyn-api-personal-instructions-controller'
```

`describe()` 回答调用方已保存的文本、保存时间与 `maxChars`；`save(text)` 替换它，并回答从存储读回的状态。空白文本清空记录。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**这个命名空间要求一个部署认识的调用方。** 它声明的身份是 `member`，这一级准入任何有身份的人，不要求组织内的身份——个人页面属于一个人，而不属于某个组织的成员。没有账号体系的部署根本不执行身份检查，这对它唯一的操作者正是对的答案。

**没有方法接受「人」这个参数。** 两个方法都从存储读 owner，而存储从请求身份读它。线上不存在调用方可以改动来作用于另一条记录的东西，于是一个人指令的私密性不依赖于某个人记得写的检查。

**`describe` 把「什么都不拥有的调用」与「指令为空的人」区分开。** `owned: false` 是有账号体系却未出示身份的调用；页面会这么说，而不是提供一个保存必被拒绝的编辑器。

**保存回答的是被留下的东西。** 视图从存储读回，而不是从参数回显，于是页面永远不会显示部署没有存下的文本。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-personal-instructions`](../../identity/personal-instructions/README.zh.md)：这两个方法背后的存储与会话记录。
- [`lyn-client-ui-settings-instructions`](../../client/ui-settings-instructions/README.zh.md)：调用它们的那张页面。
- [`lyn-api-remote-authority`](../remote-authority/README.zh.md)：执行本命名空间所声明身份的地方。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它只传输一个人写的东西，而那段文本如何进入模型请求由 `lyn-personal-instructions` 负责。

#### KV 缓存影响

请求前缀不变，因为这里没有任何内容参与请求组装。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有历史**：一次保存替换原有内容，不保留上一份文本；想找回被覆盖版本的人，从当时跑在那份文本下的会话日志里读。
- **没有管理员视图**：通过这个命名空间谁都读不到别人的指令，管理员也不行，因为 owner 是推导出来的而不是指定的。
- **一次调用一份文本**：想做工作区级指令的部署需要在线上多一个 key，而本命名空间刻意不接受它。

**运行期不变量：** 每个方法都作用于 `ownerOfCall()`，不作用于调用方提供的任何东西。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

`save` 对「什么都不拥有」的调用是拒绝，而不是写进一个共享 key，于是挂了身份服务却在无身份情况下被访问的部署会响亮地失败，而不是把所有人的指令收进同一条记录。

</details>
