---
description: "部署拥有模型这个模块独立成一个 bundle，并且 fail closed：配置错误的策略会停下启动，而不是放大访问。"
kind: "package-bundle"
---

# @lyness/lyn-module-model-governance

[English](README.md) | 中文

## 概述

本 bundle 是一个出厂产品用来声明「它的模型是部署方的决定、而不是用户的」时所选中的东西。它携带启动门禁、允许模型策略，以及拒绝策略未点名的每一条路由的那个强制执行。三行中有两行为两种出厂形态共有；策略 provider 是它们的差异所在，而本 bundle 携带静态那个，服务「只有一位管理员维护一份列表」的安装。

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

`enterprise` profile 模板选中它。开发者 profile 不选，因为一个还没被给过密钥的安装仍然应该能打开自己的 Models 页面去加一个。

管理员那份列表就是本 bundle 的 `model-policy` 行：

```yaml
- id: model-policy
  config:
    authority: your IT administrator
    allowed:
      - provider: deepseek-official
        model: deepseek-flash
```

`allowed` 是必填的、为空时被拒绝，所以一个选中本 bundle 的部署要么声明自己的模型、要么在加载时失败。托管部署会停用这一行，改为启用一个按租户解析的 provider，因为它的允许集合逐请求不同。

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

| 行 | 模块 | 角色 |
|---|---|---|
| `model-required` | `@lyness/lyn-model-required` | 启动时路由注册表为空则拒绝服务 |
| `model-policy` | `@lyness/lyn-model-policy/static` | 管理员维护的那份允许列表 |
| `model-policy-enforce` | `@lyness/lyn-model-policy/enforce` | 在 `llm/stream` waterfall 上拒绝不被允许的路由 |

最重要的那条性质是它 **fail closed**，而做到这一点需要一次修正。`model-policy` 与 `model-policy-enforce` 被登记为必需启动条目。没有那个登记时，一个激活失败的策略行会让它的强制执行一直等一个永不到来的服务，于是部署会服务**每一个**模型、而不是它允许的那些——一个配置错误的门禁反而放大了访问，而不是停下启动。这是观察到的，不是推演的：一个空的 `allowed` 列表产生了一个在跑、却完全没有强制执行的服务器。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-model-policy`](../../llm/model-policy/README.zh.md) —— 接缝、静态 provider 与强制执行。
- [`lyn-model-required`](../../llm/model-required/README.zh.md) —— 启动门禁，以及它覆盖的那个较窄情形。
- [模型是部署方的决定](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.zh.md) —— 为什么形态按模板区分、而不是靠一个运行时标志。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本 bundle 只贡献组合行；它挂载的那些包不注册任何工具、提示词或会话事件，只拒绝调用。

#### KV Cache effect

没有任何请求前缀发生变化：一次被允许的调用发出的东西与此前完全一致，一次被拒绝的调用什么都不发，而启动门禁要么让部署去服务、要么停下它。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **静态 provider 对每一次请求都提供同一份列表** —— 对一个只有一位管理员的安装而言这是对的，而这也正是托管部署需要它自己那个 provider 的原因。
- **`model-required` 覆盖的情形比它的名字听起来更窄** —— 适配器无论有没有凭据都会注册它的路由，所以这里真正的保证是那份必填且非空的 `allowed` 列表，它在加载时失败。
- **拒绝到达于调用时，而不是于选择时** —— 过滤模型选择器仍然值得做，作为建立在这条规则之上的展示。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而策略接缝只持有运营方那份被冻结的列表。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

如果这两行治理行中的任何一行将来离开了 `requiredStartupEntryIds`，本 bundle 就会无声地变成 fail-open：强制执行注入策略，所以一个未激活的策略意味着「没有强制执行」而不是「没有服务」。那个配对就是全部的安全性质所在。

</details>
