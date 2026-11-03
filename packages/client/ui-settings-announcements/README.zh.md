---
description: "「通用」设置里的系统公告行，面向发布说明的部署方与改动阅读器的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-announcements

[English](README.md) | 中文

## 概述

`dsh-client-ui-settings-announcements` 在「通用」设置里、当前版本那一行旁边，加上系统公告行。该行写出最新那条公告的标题，并打开一个阅读器，列出全部公告、各自的日期以及它们所描述的版本。它展示的内容来自客户端所连接的那个部署，经 `remote.announcements` 读取，所以桌面安装与浏览器各读自己的服务器。读取在阅读器打开时才开始，因为「没有话要说的部署」才是常态。

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
- id: ui-settings-announcements
  name: '@deepseek-ai/dsh-client-ui-settings-announcements'
```

它不接受任何配置。部署方需要挂上公告来源与公告控制器；缺了它们，那个 Remote 命名空间不存在，该行会报告公告读不到。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它紧挨着版本。** 想知道改了什么的读者，和想知道自己在哪个版本的读者，是同一个读者；而一条发布说明点名的版本正是这个部署声明过的那个——所以这一行跟在当前版本行后面，而不是另开一个分区。

**读取始于阅读器，而不是始于这一行。** 设置被打开的次数远多于公告被阅读的次数，而「没有话要说的部署」才是常态，所以一个从不打开它的读者不花费任何一次请求。同时只共享一次读取，所以打开两次不会问两次。

**失败只说它失败了。** 原因属于传输层，而读者只能重试，所以这一行提供重试，而不是一条没人能据以行动的消息。重试会先丢掉上一次的结果，于是读者看到的是这一次尝试，而不是一个说不清是否仍然成立的旧失败。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-announcements`](../../host/announcements/README.zh.md) —— 公告被写在哪里。
- [`dsh-api-announcement-controller`](../../api/announcement-controller/README.zh.md) —— 这一行所执行的那次读取。
- [`dsh-client-ui-settings-general`](../ui-settings-general/README.zh.md) —— 这一行加入的那个分区。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它在设置里渲染部署方撰写的文本。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **没有未读标记** —— 没有任何东西记录某个人看过哪些公告，所以这一行无法把新的一条提示出来。
- **打开期间不刷新** —— 阅读器展示的是那次读取返回的内容；期间发布的公告在下次打开时到达。
- **正文是受信任的 Markdown** —— 它是部署方自己的文本，由共享的 Markdown 原语渲染；一个让不受信任的作者去写它的部署，等于在发布那位作者的 Markdown。

**Runtime invariant:** 不发布任何 companion。这一行渲染的是一个 store，而它唯一的写入方就是它自己的那次读取。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

宿主半什么都不注册。它存在是为了让这个包有一个宿主入口，好让它的客户端 bundle 挂在旁边——这正是 `dsh.client` 所要求的。

</details>
