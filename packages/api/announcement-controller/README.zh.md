---
description: "对一个部署的公告的已认证 Remote 读取，面向接线这个控制器的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-announcement-controller

[English](README.md) | 中文

## 概述

`dsh-api-announcement-controller` 只暴露一次读取：这个部署发布过什么，最新在前。它是一个控制器，而不是客户端内建的东西，因为答案属于那个客户端所连接的服务器——桌面安装与浏览器各自到达自己的部署，所以他们该读的是那个部署发布的内容，而不是被烤进客户端包里的东西。只读：公告写在部署被配置的地方，所以这里没有什么可供读者改动。

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
- id: announcement-controller
  name: '@deepseek-ai/dsh-api-announcement-controller'
```

它不接受任何配置，需要一个公告来源。客户端通过 `announcements` 这个 Remote 命名空间调用它：

```ts
import type { Announcement } from '@deepseek-ai/dsh-api-announcement-controller/types'

declare const remote: { announcements: { published: () => Promise<readonly Announcement[]> } }

const announcements = await remote.announcements.published()
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它自己不添加任何东西。** 顺序、拒绝与文本都是来源的；这里只是客户端到达它们的那个地址。一个会重排或过滤的控制器，会让两个界面与发布它们的那个部署各执一词。

**来源是注入的。** 一个没挂公告的部署也不会挂这个控制器，于是询问的客户端发现的是「这个命名空间不存在」，而不是一个它分不清是「什么都没发」的空列表。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-announcements`](../../host/announcements/README.zh.md) —— 它所读取的那个来源。
- [`dsh-client-ui-settings-announcements`](../../client/ui-settings-announcements/README.zh.md) —— 唯一的使用方。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它提供一次 Remote 读取。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **没有推送** —— 客户端按需读取；某人开着页面期间发布的公告，直到他再问一次才会到达他。
- **没有按人过滤** —— 每个调用方读到同一份列表，所以部署无法只对某一个组织的员工说话。

**Runtime invariant:** 不发布任何 companion。这个控制器不持有状态；它所提供的那一个关系是来源自己的。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`./types` 是对来源词汇的再导出，而不是另写一遍，于是客户端与宿主不会在「一条公告是什么」上走偏。

</details>
