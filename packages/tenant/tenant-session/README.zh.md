---
description: "给每个会话打上它所属的租户，以及该租户贡献的身份文本，作为一条持久日志事件。"
kind: "package-reference"
---

# @lyness/lyn-tenant-session

[English](README.md) | 中文

## 概述

本插件为每个会话写入一条持久事件：该会话属于哪个租户，以及该租户贡献的约束与个性，按原文记录。归属要求每个会话在结束很久之后仍能说清属于谁；重建要求记录身份文本本身，因为它会进入模型请求，而租户之后修改配置会让这个会话变得无法还原。已经带有该记录的会话——fork 出来的，或本进程恢复的——保留它创建时的那份记录。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```yaml
- id: tenant-session
  name: '@lyness/lyn-tenant-session'
  config:
    tenantId: acme
```

`tenantId` 指明本部署创建的每个会话所属的租户，且目录必须服务该租户——格式不合法的 id，或没有任何租户认领的 id，都会拒绝挂载。同时组合 [`tenant-config`](../tenant-config/README.zh.md) 会把该租户的身份文本加进记录；不组合时记录只携带租户。

### 日志里落下什么

```jsonc
{"type":"tenant/identity","data":{
  "version":1,"tenantId":"acme","slug":"acme",
  "constraints":["Never discuss unreleased figures."],"personality":"Answer briefly."
}}
```

这条记录只进日志：它从不进入模型对话记录。身份文本是经由组装后的系统提示词到达模型的，而日志本就记录了它；这条事件的作用，是让后来的读者能归属该会话并重建它当时运行所用的文本。读回它的是 `tenant` 会话投影，因此恢复与 fork 看到的是会话创建时的那份记录。

### 目前一个部署一个租户

租户来自配置，而不是来自创建该会话的那个请求，因为会话创建过程不携带租户。服务多个租户的部署需要让请求的租户抵达会话创建，那是另一项工作。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

租户与其身份在插件启动时读取一次，因此 `session/created` 上的追加保持同步，记录在日志中的位置是确定的。那两个提示词区块通过 `agent.ctx.inject` 注册在每个 agent 自己的上下文上，于是 agent 走的时候它们就走；插件保留那些 fiber，只是为了在它自己先被卸载时把它们撤回——它自己的 teardown 到不了那里。投影状态同时是幂等守卫：折叠结果已含记录的会话不再被写入，这正是 fork 与恢复的会话保留原始戳记的原因。记录自带 `version`，沿用 subagent 描述符的做法：日后改变字段集要显式改版本，而不是悄悄放宽读者必须接受的内容。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——本插件在其中指名租户的目录。
- [tenant-config](../tenant-config/README.zh.md)——身份文本的来源。
- [system-prompt](../../core/system-prompt/README.zh.md)——那两个区块在其中排序的那个注册表。
- [持久化目录](../../../docs/persistence-catalog.zh.md#tenantidentity--log-only)——该事件的生成条目。
- [多租户子系统](../../../docs/subsystems/multi-tenancy.zh.md)——租户词汇与请求如何解析到租户。

-----

<a id="model-experience"></a>
## 模型体验

### 组织的身份

#### 模型看到什么

每个 agent 自己提示词里的两个区块，追加在部署自己的性格之后、它的政策之前。租户要求的那个口吻就是它写的那段话的原文。它的规则读作 `The organization this conversation belongs to requires:`，后面每条规则一行——说的是「组织」，不是这个部署对它的客户的那个叫法，因为提示词只承载与任务相关的概念。两样都没要的租户，两个区块都不贡献。

#### Token 影响

每个请求固定一份，长度就是那个租户写了多少。它属于前缀，所以是按可复用的前缀付一次，而不是每轮付一次。

#### KV Cache 影响

在一场对话的生命周期内稳定：文本来自那场会话自己的记录，所以租户修改身份只改变之后那些对话组装出的东西，永远不会让一场正在跑的对话的前缀失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **每个会话读取身份一次** —— 记录在创建时写下，提示词从它合成，所以一场对话跑着的时候被修改的配置，生效于修改之后创建的那些对话，而不是这一场。这正是想要的读法，也是日志唯一支持的读法。
- **四层里的两层** —— 平台与组织的身份会进入一次请求；设计里点名的用户层与 Agent 层，在这里没有记录可以承载。
- **规则是话，不是策略** —— 一条约束作为一句「请遵守」的话到达模型，没有任何东西强制它。需要一条规则被强制的租户，需要的是一个权限 preset，不是一条约束。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。投影状态与日志是一者折叠自另一者的同一份观察，而不是可能背离的两个来源。
