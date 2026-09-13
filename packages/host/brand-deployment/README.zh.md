---
description: "部署自有品牌，作用于 webserver 的 index 渲染：浏览器标题、favicon、主题色，以及运营方投放的资产文件。"
kind: "package-reference"
---

# @lyness/lyn-host-brand-deployment

[English](README.md) | 中文

## 概述

让一个部署拥有自己的视觉标识，而不必重新构建前端。配置值作用于每一个 index 响应：产品名替换浏览器标题，配置的 favicon 替换随包发布的图标链接，品牌色成为浏览器界面的主题色，整份品牌以一个 `globalThis` 值发布给页面用于界面内呈现。资产文件由运营方投放，并从一张固定表中提供，因此没有任何请求会把路径片段带进文件读取，也不存在上传入口。一行什么都不配的挂载，不会改动随包发布的 index 的任何一个字节。

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

[`lyn-web-app`](../../bundle/web-app/README.zh.md) 已经以空配置挂载了这一行，因此一个部署只需从 patch 层填充该行即可完成品牌化。

### 最小配置

```yaml
- id: brand-deployment
  name: '@lyness/lyn-host-brand-deployment'
  config:
    productName: Acme Agent
    themeColor: '#1f6feb'
    assetDirectory: /srv/acme/brand
    favicon: favicon.svg
    mark: mark.svg
    wordmark: wordmark.svg
    showPoweredBy: false
```

`assetDirectory` 是绝对路径，其中存放上面命名的三个文件；由部署脚本写入。每个文件按其角色寻址，而非按文件名：上面的 `favicon.svg` 以 `/brand/favicon.svg` 提供，而名为 `wordmark.png` 的字标以 `/brand/wordmark.png` 提供。可提供的类型为 SVG、PNG、WebP、ICO 与 JPEG。

### 为何是配置而非用户设置

配置解析把用户设置排在组合之上（[次序](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.zh.md)），因此用户能写进 `settings.yaml` 的值会压过 profile 设定的值。部署的标识必须对使用它的人成立，所以这些字段是组合层配置，且本包不注册任何设置段——组合应用之下的任何一层都无法触及它们。

### 浏览器收到什么

产品名替换第一个 `<title>`，若 head 未声明则补上一个。配置的 favicon 替换第一个 `rel="icon"` 链接，而不是再加一个，因为浏览器会自行在相互竞争的图标链接之间做选择。主题色以一条 `<meta name="theme-color">` 注入行到达。品牌对象以 `globalThis.lynDeploymentBrand` 到达，携带产品名、颜色、图标与字标的 URL 以及署名开关——成员缺失即表示部署未做配置，页面保留其内置呈现。

资产响应携带各自的图片类型与 `cache-control: no-cache`。该 URL 跨部署保持不变，因此一次替换了字节的重新部署不能继续提供旧内容。

### 可观察的失败

所有检查都在加载时进行，因此配置有误的部署不会启动。命名了资产却没有 `assetDirectory`、`assetDirectory` 为相对路径、该路径不是目录、文件缺失或不是普通文件、文件名逃出该目录、扩展名没有对应图片类型、`themeColor` 既非十六进制三元组也非颜色关键字——每一种都会让这一行失败。在路由上，未配置的角色返回 404，非 GET/HEAD 请求返回 405。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

### 设计理念

`apply` 校验颜色、一次性解析资产表，并在 effect 作用域下注册三样东西：覆盖资产表的前缀路由、一个 `webserver/index-inject` 监听器，以及一个 `tapIndex` 变换。销毁 fiber 会释放这三者，随包发布的 index 因此原样返回。

### 能用注入行的用行，不能的才用 tap

结构化注入表要喂两个渲染器——服务端 HTML 与 static worker 的启动载荷——而 `tapIndex` 只到达前者。因此品牌全局值与主题色是注入行。标题与图标链接是对随包 index 已声明的标记的**替换**，这是注入行无法表达的，所以它们走 tap。

### 资产表就是栅栏

请求永远不会把路径片段带进文件读取。`resolveAssets` 在加载时建立一张 `role → {file, url, mime}` 表，处理器在其中查请求的 pathname，查不到即 404。穿越没有可穿越之物：`/brand/../logo.svg` 只是一个不指向任何角色的 pathname。

### 源码地图

- `src/index.ts` —— 整个插件：配置 schema、资产解析、路由处理器、注入行与 index 变换。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当品牌契约不够用时读这些：先是它写入的渲染面，然后是决定这些字段归属何处的配置次序。

- [Webserver](../webserver/README.zh.md) —— 本插件注册的注入表与 index tap。
- [lyn-web-app bundle](../../bundle/web-app/README.zh.md) —— 挂载这一行的应用。
- [Configuration source ownership](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.zh.md) —— 为什么这些字段是组合层配置而非用户设置。
- [Generated configuration catalog](../../../docs/config-catalog.zh.md#lynesslyn-host-brand-deployment) —— 所有可接受的配置字段及其源声明。

-----

<a id="model-experience"></a>
## 模型体验

无。本包写的是浏览器呈现，不注册任何面向模型的内容；任何配置值都不会进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **界面内的产品名仍是构建期内置的** —— 服务端页面的标题在此被替换，但 `AppFrame` 从构建期的 `LYNESS_CLIENT_TITLE` 读取它自己的产品标题。把它改为走 `lynDeploymentBrand` 需要一个客户端占位方，属于独立工作。
- **图标与字标已发布但尚未绘制** —— 它们的 URL 已到达页面，渲染它们的客户端插槽占位方属于独立工作。
- **static worker 形态的部署会失去标题与图标** —— 两者都是 `tapIndex` 替换，而 worker 形态只消费结构化注入行。品牌全局值与主题色能到达它。
- **没有租户层** —— 一个部署一份品牌。按租户品牌化需要一条资产接收路径，以及随之而来的跨租户检查。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作背景——点击展开</summary>

无。

</details>

**Runtime invariant:** 不发布伴随检查。本包拥有的每一项关系都在加载时由它自己的配置决定，并在每个响应中从同一张表重新读取，因此不存在第二个可独立观察、可能与之背离的来源。路由与 tap 的注册/释放对称性由本包的销毁测试覆盖。
