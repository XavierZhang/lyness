---
description: "brand-studio profile：由图标 PNG 与字体生成部署品牌并应用到 profile；供私有化部署的运营方与品牌工具链维护者阅读。"
kind: "package-bundle"
---

# `@lyness/lyn-brand-studio`

[English](README.md) | 中文

## 概述

本 bundle 即 `lyn --profile brand-studio`，是私有化部署运营方在服务器上运行的一次性命令。它把图标 PNG 描成标志与 favicon 两个 SVG，用运营方提供的字体排版产品名，写出这三个文件，并让某个 profile 补丁层中的 `brand-deployment` 行指向它们。需要给部署换品牌、又不想手写 SVG 或 patch YAML 时选择它。它挂载的任何内容都不会到达模型。

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

```sh
lyn --profile brand-studio --name 领驭 --icon ./lyness.png --accept-trademark

lyn --profile brand-studio --name Acme --icon ./acme.png --font ./AcmeSans-Bold.otf \
  --theme-color '#1a73e8' --accept-trademark --accept-font-license
```

`--name`、`--icon` 与 `--accept-trademark` 为必填；使用 `--font` 时须同时给出 `--accept-font-license`。图标须是边长不小于 1024 像素的 PNG，浅色或透明背景上的深色图形；其他情况 `lyn-host-brand-icon` 会拒绝并给出原因。不带 `--font` 时，名称用 [`brand-fonts`](../../host/brand-fonts/README.zh.md) 的内置字体排版，覆盖拉丁字母、希腊文、西里尔文、中文、日文与韩文。`--font` 接收品牌方自有的 TTF、OTF、WOFF 或 WOFF2 文件，它须覆盖名称中的每个字符，且其授权须允许把字形用于 logo，由 `--accept-font-license` 确认。两种情况下字体都只服务于字标：本工具在运营方的服务器上读取它，既不复制也不分发该文件，写出的是轮廓图形而非字体软件。`--theme-color` 接受十六进制颜色或颜色关键字；不传时保留该行已有的颜色。

### 写出的内容

三个 SVG 以 `mark.svg`、`wordmark.svg`、`favicon.svg` 写入 `--asset-dir`，默认 `$LYNESS_HOME/brand`。品牌行写入 `--target` 的补丁层，默认 `web`：`$LYNESS_HOME/profiles/web/cordis.patch.yml`。从未启动过的随附 profile 会先被初始化，与其首次启动时完全相同。该行设置 `productName`、`themeColor`、`assetDirectory` 与三个文件名；`showPoweredBy` 等其他配置键、其他行、注释与 `!!js` 值保持原样。

在写入任何内容之前，所有输入都已检查、新的补丁层也已组装完毕。SVG 先于补丁层写入，因此会在补丁层变化时重载的 `lyn web` 立即应用品牌，且不会读到指向缺失文件的行。其他 profile 在下次启动时应用。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本 bundle 的 patch 只插入一行，且不叠加在 `lyn-base` 之上，因此配置树不加载任何模型、会话或 Web 插件。[`src/index.ts`](src/index.ts) 通过 `parseCmdline` 用 commander 解析 launcher 传入的参数，运行一次，并经 `ctx.appExit` 请求退出：成功时在 stdout 输出报告并以 0 退出，失败时在 stderr 输出错误并以 1 退出。[`src/studio.ts`](src/studio.ts) 承载一次运行。每个生成的 SVG 须先通过 `isBrandSvg` 才会写入。补丁层通过 `yaml` 的文档模型编辑，它会保留普通解析再输出时会丢失的注释与未解析的 `!!js` 标签；每个文件都用 `writeFileAtomic` 替换。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

阅读以下页面，可以沿着品牌从本命令一路走到浏览器。

- [brand-icon](../../host/brand-icon/README.zh.md)——描边 PNG，并定义品牌 SVG 语法。
- [brand-wordmark](../../host/brand-wordmark/README.zh.md)——排版名称，并拒绝无法排版的字体与名称。
- [brand-deployment](../../host/brand-deployment/README.zh.md)——提供写出的文件，并把品牌注入页面。
- [ui-brand-lyness](../../client/ui-brand-lyness/README.zh.md)——在 Web 客户端中绘制部署品牌。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本 bundle 是运营方命令，其配置树不挂载任何面向模型的插件；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本 bundle 既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


以下是当前的约束，不是任务清单。

- **只接受参数** —— 所有输入都是命令行参数；缺少参数时命令不会交互式询问。
- **只有上传路径** —— 用生图模型生成图标需要仓库尚未具备的图像生成能力。
- **内置字体覆盖六种文字** —— 名称若使用阿拉伯文、希伯来文、泰文等内置字体不绘制的文字，需要用 `--font` 提供字体。
- **一个 profile 一份品牌** —— 该行是部署级的，没有租户层。
- **补丁层会被重新序列化** —— 注释与 `!!js` 值得以保留，但其他行的引号与空行可能被规范化。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。插件运行一次后请求退出；它不保留任何可能被独立观察推翻的状态。
