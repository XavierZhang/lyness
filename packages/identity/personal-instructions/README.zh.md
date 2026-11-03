---
description: "一个人对自己的 agent 说的话，为他保存，并记录在他开的每一段会话上。"
kind: "package-reference"
---

# @lyness/lyn-personal-instructions

[English](README.md) | 中文

## 概述

`lyn-personal-instructions` 是提示词里的用户层。部署的人格与组织的规则都有自己的落脚处，夹在中间的那个人却没有——因为托管形态下的人没有文件可编辑。这个插件保存每个人对自己 agent 说的话，在他开的每一段会话里写一条持久日志事件，并从那条记录把文本组装进每个 agent 的提示词——位置在组织的规则之后、agent 自己的人格之前。

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

把它挂在会话、agent 与提示词注册表所在的位置：

```yaml
- id: personal-instructions
  name: '@lyness/lyn-personal-instructions'
  config:
    maxChars: 4000
```

`maxChars` 是单个人可保存文本的上限；默认取存储所接受的上限，想收紧 token 预算的部署可以设得更小。别的都不用配：一段会话的指令取自谁，由创建它的调用方身份决定。

设置页通过 `lyn-api-personal-instructions-controller` 读写。Host 侧的调用方直接用服务：`ctx.personalInstructions.ownerOfCall()` 回答这次调用作用在谁身上，`get` 与 `save` 接受那个 owner。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**权威是那条记录，不是存储。** 文本在会话创建时被拷进会话日志，并从那里组装。任何进入模型请求的东西都必须能从会话日志还原，而在组装时读存储，等于一个人改自己的指令就改掉了一段正在进行的对话此前说过的话。

**每一段有归属的会话都带一条记录，哪怕是空的。** 一条「文本为空」的记录，正是后来的读者用来区分「这段对话跑在没有指令的状态下」与「从来没有人问过」的东西。没有人开的会话——CLI 运行、子 agent、入站 webhook——不带记录，而不是带上别人的。

**三种产品形态各自回答 owner 这个问题。** 不挂请求身份服务的部署只有一个操作者，存在一个众所周知的 key 下。挂了的部署存在登录者名下，而没有出示身份的调用什么都不作用。

**这个分区是追加的，永远不是前置的。** 它占据组织规则与 agent 人格之间的位置，于是一个人写的文本无法放宽上面各层所设的边界，而每一个策略分区仍排在它之后。

**读取是同步的。** 戳记跑在创建宣告之后的那个微任务上，没有一个 tick 可以花在存储上，所以插件在挂载时等待域打开一次，之后直接读内存中的记录。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-personal-instructions-controller`](../../api/personal-instructions-controller/README.zh.md)：界面读它所经由的 Remote 命名空间。
- [`lyn-client-ui-settings-instructions`](../../client/ui-settings-instructions/README.zh.md)：一个人编辑它们的那张设置页。
- [`lyn-tenant-session`](../../tenant/tenant-session/README.zh.md)：本层所紧跟的组织层，做法相同。
- [`lyn-session-ownership`](../session-ownership/README.zh.md)：一段会话属于谁，本插件的 owner 问题跟随它。

-----

<a id="model-experience"></a>
## 模型体验

### 这个人自己的指令

#### 模型看到什么

每个 agent 自己的提示词里一条分区，位置在组织的规则之后、agent 的人格之前。内容是 `The person in this conversation has written these instructions for you:`，后面原样接这个人的文字——用「人」，而不是本部署对账号的叫法，因为提示词只携带与任务相关的概念。没写过指令的人贡献一条空分区，于是组装出的提示词与从未挂过这个插件的部署逐字节一致。

#### Token 影响

每次请求固定，长度等于这个人写了多少，上限为 `maxChars`。它属于前缀，因此按每个被缓存的前缀付一次，而不是每轮付一次。

#### KV 缓存影响

在一段对话的生命周期内稳定：文本来自那段会话自己的记录，所以一个人修改自己的指令，改变的是之后开的对话所组装的内容，永不作废正在进行的那一段的前缀。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **已经开着的对话保持它开始时的那份**：这是设计如此，页面也会这么说；想让新文本生效的人开一段新对话。
- **一个人一份文本，不是一个工作区一份**：想给不同项目用不同指令的人走工作区文件链，本插件不碰它。
- **没有部署侧的审阅**：必须禁止个人指令的部署不组合这一行；平面内部没有一个开关可以关掉它，因为一个汇报别人决定的控件不属于个人页面。
- **上限是 token 预算，不是校验**：文本原样携带，所以按 token 付费的部署设 `maxChars`，而不是指望人把话说短。

**运行期不变量：** 每段会话一条记录，只写一次；组装出的分区永远来自那条记录。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

单操作者的 key 只在完全没有挂请求身份服务时才会被用到，而不是在某次调用恰好不带身份时。这个区别在有账号体系的部署上很重要：否则在请求之外创建的会话会被戳上一条谁都不拥有的共享记录。

</details>
