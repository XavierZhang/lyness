---
description: "定时跟进模块作为独立的出厂 bundle，面向选中它的部署与把它与产品分开升级的维护者。"
kind: "package-bundle"
---

# @lyness/lyn-module-schedule

[English](README.md) | 中文

## 概述

本 bundle 就是定时跟进这个默认模块：宿主[Schedule 服务](../../schedule/schedule/README.zh.md)与它的[浏览器目录](../../client/ui-schedule/README.zh.md)，作为 profile 选中的一个单位。把模块单独打包，正是让平台能为它发出修复而不必发布整个产品的原因，也是让"客户的替换"与"平台自己的那一版"成为同一个有序列表里两个 bundle 的原因。两行都保留它们在 Web 补丁里的 `disabled: true`：本 bundle 搬动这个模块，不打开它。

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

`web` profile 模板会选中它，所以新建的 profile 自带。在本 bundle 存在之前创建的 profile 会在下一次启动时被规范化到当前模板，因为它先前那个精确的 bundle 元组被记录为"安装所拥有"——这次重新打包不会让能力丢失。

在**插件**页把这两行打开，或在后续补丁层里覆盖：

```yaml
- id: schedule
  disabled: false
- id: ui-schedule
  disabled: false
```

打开这个服务会给该 profile 上每个 agent 的工具目录加上四个 `schedule_*` 工具，从而改变可复用的请求前缀。这正是本 bundle 出厂时把它们关着的理由：搬动一个模块与改变模型看到什么，是两个独立的决定。

-----

<a id="understand-the-implementation"></a>
## 理解实现

这个 bundle 就是它的补丁文档。`src/index.ts` 不导出任何东西，它存在只因为构建流程要为每个包解析一个入口。

补丁插入的是 Web 补丁先前承载的那两行。它们的 id 没有变，所以已经覆盖了 `schedule` 或 `ui-schedule` 的 profile 补丁层继续有效：模块在 bundle 之间移动，不移动它那些行的地址。

| 文件 | 作用 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的两行 |
| [`locale/en.json`](locale/en.json) | 插件页读取的展示元信息 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-schedule`](../../schedule/schedule/README.zh.md) —— 宿主服务、它的任务存储与投递。
- [`lyn-client-ui-schedule`](../../client/ui-schedule/README.zh.md) —— 浏览器目录。
- [默认模块与视图切分](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 为什么每个默认模块各自是一个 bundle。

-----

<a id="model-experience"></a>
## 模型体验

None, as this bundle contributes only composition rows; the Schedule service owns every prompt, tool, and session event, and contributes them only once its row is switched on.

#### KV Cache effect

两行保持关闭时，模型请求前缀不发生变化。打开这个服务会把它的工具加入目录，从而改变该 profile 上每个会话的前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明本 bundle 在什么情况下需要特别当心。它们是当前的约束，不是任务清单。

- **出厂时是关闭的** —— 选中这个 bundle 让模块可用，不是让它生效。想要定时跟进的部署覆盖这两行。
- **迁移只覆盖一个先前的元组** —— 被手工改过 bundle 列表的 profile 按设计不被触碰，所以手工改过的 profile 也要手工加上这个 bundle。
- **只有 `web` 模板选中它** —— 自定义 profile 自己把它加进 `lyn.profile.bundles`。

**Runtime invariant:** No companion is published. 本 bundle 不拥有任何运行时状态；它插入的行由 Loader 观察，而 Schedule 服务发布它自己的 invariant。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
