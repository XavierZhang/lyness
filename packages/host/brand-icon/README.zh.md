---
description: "把品牌图标 PNG 转成部署提供的单色 SVG 图标与正方形 favicon，并按本工具链写出的格式检查品牌 SVG。"
kind: "package-reference"
---

# @lyness/lyn-host-brand-icon

[English](README.md) | 中文

## 概述

把图标 PNG（运营方上传的，或生图模型画的）变成部署提供的图标与 favicon。`vectorizeIcon` 把 PNG 铺到白底上，按亮度区分图形与背景，裁到图形范围，再描成路径。它返回一个紧贴图形、填充为 `currentColor` 的图标，以及一个在暗色配色方案下变白的正方形 favicon。`isBrandSvg` 确认一份文档恰好是本工具链写出的格式。无法做成可用图标的图片会以固定的代码被拒绝。

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

这是一个库，不是插件：它不注册任何东西，也不读取配置。私有化部署的品牌工具调用它，把两份文档写成 [`brand-deployment`](../brand-deployment/README.zh.md) 提供的 `mark` 与 `favicon` 文件。

### 最小用法

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { isBrandSvg, vectorizeIcon } from '@lyness/lyn-host-brand-icon'

const traced = vectorizeIcon(new Uint8Array(await readFile('/srv/acme/upload/icon.png')))
for (const [name, svg] of [['mark.svg', traced.icon], ['favicon.svg', traced.favicon]] as const) {
  if (!isBrandSvg(svg)) throw new Error(`${name} is not a brand SVG`)
  await writeFile(`/srv/acme/brand/${name}`, svg)
}
```

### 输入必须满足什么

- PNG，每边在 1024 到 4096 像素之间。尺寸从文件头读取，所以超大文件在解码任何像素之前就会被拒绝。
- 白色或透明背景上的深色图形。铺到白底后，比中灰更暗的像素算作图形；颜色会被丢弃。
- 图形宽高比在 1:1 到 1.4:1 之间，按图形本身测量，不含四周空白。

### 文档保证什么

- 图标里只有填充为 `currentColor` 的 `<path>` 元素，坐标框恰好等于图形在原图中的宽高（像素），不留边。
- favicon 是正方形。图形居中，长边占边长的 96%，与 Web 壳自己的 favicon 一致；图形为黑色，在 `prefers-color-scheme: dark` 下变白，因为浏览器标签栏跟随浏览器主题。
- 坐标最多保留两位小数，同一个 PNG 总是产出同样的文档。两份文档都能通过 `isBrandSvg`。

### `isBrandSvg`

它只接受图标包与字标包写出的文档：`width` 与 `height` 和 `viewBox` 一致、填充为 `currentColor` 或黑色的 `<svg>`，一条可选的固定暗色规则，以及一条或多条路径，路径数据只含移动、直线、曲线与闭合命令。其他任何元素、属性、注释、XML 声明、实体或引用都不通过。[`brand-wordmark`](../brand-wordmark/README.zh.md) 产出的字标同样能通过。

### 拒绝情况

每一种拒绝都是一个 `IconError`，调用方可以按其 `code` 分支处理：

| `code` | 原因 |
|---|---|
| `NOT_PNG` | 这些字节没有以 PNG 签名与文件头开头。 |
| `TOO_SMALL` | 有一边小于 1024 像素。 |
| `TOO_LARGE` | 有一边大于 4096 像素。 |
| `UNREADABLE_PNG` | 像素数据无法解码。 |
| `NO_INK` | 没有足够深的图形，或图形太小描不出来。 |
| `DARK_BACKGROUND` | 四个角都是深色。 |
| `TOO_TALL` | 图形高大于宽。 |
| `TOO_WIDE` | 图形宽于 1.4:1。 |
| `TOO_COMPLEX` | 图形描出来超过 64 个独立形状。 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

### 设计理念

`vectorizeIcon` 从 PNG 文件头读出宽高，用 `@neplex/vectorizer` 解码像素，把每个像素铺到白底上与中灰比较亮度，得到图形掩码。它把图形复制到四周留 16 像素空白的白色画布上，用描边器的黑白预设描这张画布，再把每个形状被描出的位移折算进坐标。图标把形状放在图形的左上角；favicon 把它们移到正方形中央。两份文档在返回前都会用 `isBrandSvg` 检查。

### 为什么选这个描边器

它用一个 MIT 许可的依赖同时完成 PNG 解码与原始像素描边，并为 macOS、Linux 与 Windows 提供预编译二进制。权衡过的其他方案记在[决策记录](../../../.agents/notes/implemented/architecture/2026-09-15-brand-icon-from-png.zh.md)里。

### 源码地图

- `src/index.ts` —— 整个库：边界常量、错误类型、读取文件头、识别图形、描边，以及品牌 SVG 检查。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

想了解这些文档会被用在哪里、为什么图标要以 PNG 输入，读这些。

- [brand-deployment](../brand-deployment/README.zh.md) —— 提供图标与 favicon 文件。
- [brand-wordmark](../brand-wordmark/README.zh.md) —— 写出同样能通过 `isBrandSvg` 的字标。
- [品牌图标决策](../../../.agents/notes/implemented/architecture/2026-09-15-brand-icon-from-png.zh.md) —— 为什么每个品牌 SVG 都由本工具链写出。

-----

<a id="model-experience"></a>
## 模型体验

无。本库把图片变成图形，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **只支持单色** —— 多色 logo 会变成单色，白底上的浅色图形会因为没有图形而被拒绝。
- **矢量原稿会被重新描边** —— 已有 SVG 的运营方要先导出 PNG，描出来的路径不如原稿精确。
- **由四个角判断背景** —— 图形恰好占满四个角时，会被当作深色背景拒绝。
- **原生模块** —— 描边在预编译的原生插件里运行，没有发布对应二进制的平台无法加载本包。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作背景——点击展开</summary>

无。

</details>

**Runtime invariant:** 不发布伴随检查。本库不持有状态，也不注册任何东西，因此不存在可以被独立观察推翻的归属关系。
