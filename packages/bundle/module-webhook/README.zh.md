---
description: "Webhook 入站模块独立成一个 bundle，出厂惰性，因为启用后的适配器是会创建会话的、带认证的公网 HTTP 入站。"
kind: "package-bundle"
---

# @lyness/lyn-module-webhook

[English](README.md) | 中文

## 概述

本 bundle 就是 webhook 入站这个默认模块：一个外部事件变成一个新的 agent 会话。它携带宿主规则运行时与 GitHub 适配器。两行出厂都是**停用**的，而这同时是结构性的与安全性的决定——该适配器四个必填字段里有一个是凭据引用，而启用后的适配器是会创建根会话的、带认证的公网 HTTP 入站。

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

`web` profile 模板选择了它，所以新建的 profile 自带它可用。在本 bundle 存在之前创建的 profile 会在下次启动时被规范化到当前模板，因为它此前那组确切的 bundle 元组被记录为安装方所有。

选择这个 bundle 并不会把模块打开，而且仅仅启用那两行也还不够。需要三样东西：

```yaml
- id: webhook-runtime
  disabled: false
- id: webhook-github
  disabled: false
  config:
    source: github
    path: /webhook/github
    secretEnv: GITHUB_WEBHOOK_SECRET
    maxBodyBytes: 1048576
```

然后还要一条规则。规则是部署自己编写的插件：它们注入 `webhookRuntime`，并把 `register()` 返回的 disposer 交出去。运行时不携带任何规则，所以一条配置好的路由在没有规则时会接收投递、却什么都不启动。[GitHub 评审指南](../../../docs/user/guide/github-review.zh.md)完整走过一个规则模块、一个专用入站端口、密钥设置与工作区路由。

适配器的每个字段都是必填的，所以一个启用了却没有 config 的适配器行会在加载时大声失败，而不是打开一条未经校验的路由。

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

| 行 | 模块 | 角色 |
|---|---|---|
| `webhook-runtime` | `@lyness/lyn-webhook` | 宿主规则注册表与那一个内置动作：在某个 Web 工作区里创建一个根会话 |
| `webhook-github` | `@lyness/lyn-webhook-github` | 一条确切的 HTTP 路由：限长并校验 GitHub 的原始 body，然后派发 |

该运行时在 Web 宿主平面上、于 Agents、模型默认值、agent preset、权限预设、标题与工作区注册表之后加载，而这正是本 bundle 在模板中的位置所产生的次序。

那条安全边界值得精确地写出来，因为共享密钥很容易被误当成它。密钥证明的是这次投递来自已配置的那个发送方；它对「由此产生的会话属于哪个租户」什么都没说。承载那个决定的是路由与工作区路由，也就是入站接口笔记里描述的「适配器认证、平面授权」的分工。服务多于一个租户的部署要刻意地做这个决定，而不是从某个默认值里继承它。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的两行，以及每一行为何出厂是关着的 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`webhook/`](../../experimental/webhook/README.zh.md) —— 规则接口、会话请求与 GitHub 适配器。
- [GitHub 评审指南](../../../docs/user/guide/github-review.zh.md) —— 一份可照做的规则、端口、密钥与路由设置。
- [入站接口与会话平面](../../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.zh.md) —— 为什么适配器负责认证、平面负责授权。
- [`lyn-module-lsp`](../module-lsp/README.zh.md) —— 另一个惰性是结构性的模块。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那些行：一条命中的规则拥有它那个会话起始的初始提示词，而通用运行时不添加任何自己的框架文本。

#### KV Cache effect

在这些行保持停用时——也就是它们的出厂状态——没有任何模型请求发生变化，所以选择本 bundle 会让每一个既有前缀逐字节不变。启用后，一条规则的提示词开启一个新会话，所以它是在建立该会话可复用的前缀，而不是让任何东西失效；一条纳入外部文本的规则自己负责把那部分标注为不可信，正如出厂的 GitHub 示例对选中的 PR 字段所做的那样。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **它出厂是惰性的，而且没法不是** —— 密钥、路由与来源名属于部署自己提供，而对一条公网路由来说没有哪个默认值是对的。
- **仅仅启用那两行还不够** —— 没有部署自己编写的规则，那条路由会接收投递、却什么都不启动。这是运行时的设计，不是本 bundle 的缺口。
- **密钥认证的是发送方，不是租户** —— 在共享宿主上，路由与工作区路由才是授权边界，需要逐个部署决定。
- **这里只有 GitHub 适配器** —— 别的提供方需要它自己的适配器包；运行时的接口与提供方无关。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而运行时发布它自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

这是第一个因为两条互相独立的理由而惰性的默认模块，而两条都必须在后续编辑中存活：没有合理默认值的必填配置，以及一条其授权属于逐个部署决定的公网路由。去掉其中一条，并不会让另一条消失。

</details>
