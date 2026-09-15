---
description: "面向侧栏与会话首屏的 lyness 品牌填充，可被部署品牌逐项替换；供选择或替换品牌呈现的用户与维护者阅读。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-brand-lyness

[English](README.md) | 中文

## 概述

本包在所有客户端构建中，用 lyness 图形填充侧栏标志、侧栏名称与会话首屏标志。当服务端页面带有来自 `lyn-brand-deployment` 的部署品牌时，该品牌的标志、字标与产品名替换对应的 lyness 图形，因此同一份客户端构建可以服务品牌各异的部署。lyness 部署应选择本包，通过组合配置定制品牌的私有化部署同样适用。本包不保留运行时状态，也不影响模型请求。

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

将本插件挂载到浏览器插件名单。Web 应用 bundle 已用它取代 `lyn-client-ui-brand-official`，因此由该 bundle 组合的部署无需额外步骤。

### 部署品牌

每个填充在每次渲染时读取 `globalThis.lynDeploymentBrand`，该值由 `lyn-brand-deployment` 在客户端启动前写入。配置了部署标志时，两处标志都显示部署标志。名称优先显示部署字标；没有字标时以文本显示部署产品名；两者都没有时显示 lyness 字标。不是非空字符串的成员，以及不是页面同源路径的 URL，一律视为缺失，于是保留 lyness 图形，而不是显示一张破图。只设了产品名而没有标志的部署，会在 lyness 标志旁显示该名称。

### 替换品牌

只改品牌的部署配置 `lyn-brand-deployment` 并保留本包；这类改动需要重启 host，但不需要重建客户端。需要不同内置图形的部署，改为组合另一个占据相同三个 slot 的包。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

两个侧栏填充作为一组声明感知的注册安装：嵌套的 `ctx.slots.inject()` 调用等待两个侧栏声明，并一并撤回两个填充，HMR 期间也不会留下残缺的品牌混合。首屏填充等待自己的声明，该声明由 `lyn-client-ui-conversation` 独立于侧栏作出。图形是 [`src/client/artwork.ts`](src/client/artwork.ts) 中的路径数据：`lyn-brand-icon` 从 lyness 图标 PNG 描出标志，`lyn-brand-wordmark` 用 Inter SemiBold 排出字标；两者都以 `currentColor` 填充。页面全局读取器是 [`src/client/deployment-brand.ts`](src/client/deployment-brand.ts)；node 半部是一个空 Loader 座位。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当品牌面不够用时阅读以下页面。它们从品牌来源进入渲染这些 slot 的外壳。

- [brand-deployment](../../host/brand-deployment/README.zh.md)——提供部署的品牌资产，并注入本包读取的品牌。
- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark`。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了品牌呈现的供给方式。它们是当前包约束，不是品牌设计对比或任务积压。

- **本地构建标签被隐藏**——侧栏的回退名称在开发构建中显示构建版本；本包在所有构建中占据名称 slot，因此那里不再显示版本。
- **首屏标志不做变形**——回退的鱼在悬停时改变轮廓；lyness 标志与部署标志只保留首屏的摆动动画。
- **内置图形需要重建**——lyness 路径编译进客户端 bundle；只有部署品牌无需重建即可更换。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。本包不保留可变状态；侧栏填充通过一个事务性 effect 安装和释放，首屏填充通过另一个。
