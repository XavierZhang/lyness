---
description: "回合交付物模块独立成一个 bundle：改动文件记录器、它的卡片，以及给接受贡献的 preset 的 present 工具。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-deliverables

[English](README.md) | 中文

## 概述

本 bundle 就是回合交付物这个默认模块：一个回合交给用户的东西。改动文件记录器与它的回合尾部卡片是宿主行与浏览器行，而 `present` 工具是按 agent 的，经由[preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md)接缝到达接受贡献的 preset。它出厂就是开着的，并把两项互不相干的特性放在同一个开关下：agent 声明交付物，以及工作区记录改动了什么。

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

`web` profile 模板选择了它，所以新建的 profile 自带它。在本 bundle 存在之前创建的 profile 会在下次启动时被规范化到当前模板，因为它此前那组确切的 bundle 元组被记录为安装方所有。

从 **Plugins** 页，或在更靠后的补丁层里把其中某部分关掉：

```yaml
- id: ui-deliverables
  disabled: true
- id: workspace-changes
  disabled: true
- id: deliverables-preset-contribution
  disabled: true
```

这三行确实互不相干。只关掉卡片，会让尾部的那个洞渲染为空，而事件仍然在累积；只关掉记录器，会停止产生改动文件事件；只关掉贡献，会把 `present` 从两个视图默认里移除，而不触动官方那几个模式。

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

| 行 | 模块 | 平面 | 角色 |
|---|---|---|---|
| `ui-deliverables` | `@deepseek-ai/dsh-client-ui-deliverables` | 浏览器 | 回合尾部的改动文件卡与交付卡 |
| `workspace-changes` | `@deepseek-ai/dsh-workspace-changes` | 宿主 | 从 git 快照记录每个回合改动的文件 |
| `deliverables-preset-contribution` | `@deepseek-ai/dsh-tool-present/preset-contribution` | 贡献 | 把 `present` 行交给每个接受贡献的 preset |

这条贡献只到达接受贡献的 preset，而这种不对称是刻意的。官方那四个模式按上游出厂的样子，各自把 `@deepseek-ai/dsh-tool-present` 声明为自己的一行并保留它；一条到达它们的贡献会变成第二行去注册同一个工具名。所以 `standard`、`ptc`、`cordis` 携带声明行，而两个视图默认携带这条贡献，每个 preset 最终都只有一行。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的三行 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`deliverables/`](../../deliverables/README.zh.md) —— `present` 工具与改动文件记录器。
- [preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md) —— 为什么一个模块贡献一行，而不是去改 preset。
- [Web 交付物](../../client/ui-deliverables/README.zh.md) —— 本 bundle 挂载的那些卡片。
- [默认模块与两个视图](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 为什么每个默认模块各自一个 bundle。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那些行：`dsh-tool-present` 拥有 `present` 的 schema 与它的结果，而记录器贡献一个只由客户端读取的持久事件。

#### KV Cache effect

这条贡献会为处在接受贡献的 preset 上的会话，向请求前缀增加一个工具 schema，这是选择那一刻的一次性变化，而不是每次请求的变化；官方那些模式本来就从自己的声明行携带了那个 schema，所以对它们而言前缀不变。记录器不贡献任何提示词文本、也不贡献运行时上下文——它的 `workspace/changes` 事件由客户端读取，从不被折进请求——所以它让前缀逐字节不变。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **一个开关覆盖两项互不相干的特性** —— 声明交付物与记录改动共处一个模块，是因为它们共享同一个主题，而不是同一套机制。只想要其中一项的部署把另一项的那行关掉。
- **贡献不到达官方那些模式** —— 它们保留自己的声明行，所以关掉本 bundle 的贡献只改变两个视图默认。
- **记录器需要 git 才有完整覆盖** —— 没有仓库或没有 git 时，只列出文件工具的改动。这是记录器的性质，不是本 bundle 的。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过。
- **贡献次序由中央分配** —— 本 bundle 那一行处在注册表所有的一个固定位置上，所以部署无法把它相对于另一个模块贡献的行重新排序。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而记录器发布它自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

这是第一个「被贡献的行与同一个插件在其他 preset 里的声明行并存」的模块，正是它让注册表的重复 id 与声明行冲突检查成为承重的，而不只是理论上的。

</details>
