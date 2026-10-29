---
description: "设置里的指令分区：一个人对自己的 agent 说的话。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-instructions

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-instructions` 是个人平面的指令页：一个编辑器，写一个人对自己 agent 说的话；一个计数，对照这个部署接受的上限；以及一行话，说明已经开着的对话保持它开始时的那份。它是个人页面而不是管理页面，因为这个控件属于本人——没有别人设定它，这里也没有任何东西在汇报别人替他做的决定。

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
- id: personal-instructions-controller
  name: '@lyness/lyn-api-personal-instructions-controller'
- id: ui-settings-instructions
  name: '@lyness/lyn-client-ui-settings-instructions'
```

别的都不用配。分区注册进 `settings.section`，也就是个人平面，对每一个读者都出现。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**草稿属于组件，已保存的文本属于 store。** 它们回答的是不同的问题——这个人正在打什么，以及他下一段对话会携带什么——所以页面会说这两者中哪一个正在生效，而不是让一份未保存的草稿读起来像一项设置。

**草稿在这个人开始打字之前跟随部署的答案。** 每次有答案就重置，会在一次保存落地时丢掉他正在写的东西；永不跟随，又会藏起部署当前持有的内容。

**读取在分区打开时开始，而不是在插件加载时。** 从不打开这里的人，不让部署付出一次请求。

**清空是一次空白保存，不是第二个调用。** 命名空间把空白文本当作「没有指令」，于是这个按钮没有自己可以弄错的东西。

**「什么都不拥有的调用」与「读取坏了」被区分开。** 前者没有可重试的也没有可编辑的，所以就这么说；只有后者提供重试。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-personal-instructions-controller`](../../api/personal-instructions-controller/README.zh.md)：本页读写的那个命名空间。
- [`lyn-personal-instructions`](../../identity/personal-instructions/README.zh.md)：保存下来的文本之后会做什么。
- [`lyn-client-ui-settings`](../ui-settings/README.zh.md)：两个分区平面槽位的声明处。

-----

<a id="model-experience"></a>
## 模型体验

无。本包不注册任何工具或提示词：它只是一个存储文本之上的编辑器，那段文本如何进入模型请求由 `lyn-personal-instructions` 负责。

#### KV 缓存影响

本页不改变请求前缀；保存改变的是这个人下一段会话所记录的内容，那由那个包自己的「模型体验」一节描述。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **不预览组装后的提示词**：页面显示的是这个人写的文本，不是模型将读到的那条分区；两者差一行引导语。
- **没有排版辅助**：输入框是纯文本，因为存下来的记录是纯文本，而富文本编辑器会承诺提示词并不保留的结构。
- **草稿只活在打开着的面板里**：带着未保存的改动关掉设置会丢掉它们，而且没有任何提示。

**运行期不变量：** 编辑器发送的正是输入框里的内容，显示的正是部署回答的内容。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

草稿与已保存文本相同时保存按钮是禁用的，这同时也让「已保存。」这句提示不会停留在一个此后又被编辑过的输入框下面。

</details>
