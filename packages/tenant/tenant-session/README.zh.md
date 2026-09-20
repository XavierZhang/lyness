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

租户与其身份在插件启动时读取一次，因此 `session/created` 上的追加保持同步，记录在日志中的位置是确定的。投影状态同时是幂等守卫：折叠结果已含记录的会话不再被写入，这正是 fork 与恢复的会话保留原始戳记的原因。记录自带 `version`，沿用 subagent 描述符的做法：日后改变字段集要显式改版本，而不是悄悄放宽读者必须接受的内容。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——本插件在其中指名租户的目录。
- [tenant-config](../tenant-config/README.zh.md)——身份文本的来源。
- [持久化目录](../../../docs/persistence-catalog.zh.md#tenantidentity--log-only)——该事件的生成条目。
- [多租户子系统](../../../docs/subsystems/multi-tenancy.zh.md)——租户词汇与请求如何解析到租户。

-----

<a id="model-experience"></a>
## 模型体验

无，因为该记录只进日志；身份文本经系统提示词进入模型请求，而日志已单独记录了它。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **一个部署一个租户** —— 记录写的是配置指定的租户，而不是创建该会话的那个请求所属的租户。
- **身份只读取一次** —— 进程运行期间被修改的配置，要到下次重启之后创建的会话才生效；而今天交付的只读后端本来也无法在运行中变化。
- **没有任何东西把身份合成进提示词** —— 记录说明租户贡献了什么；把平台、组织、用户与 Agent 的身份合成进一次请求，是另一项工作。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。投影状态与日志是一者折叠自另一者的同一份观察，而不是可能背离的两个来源。
