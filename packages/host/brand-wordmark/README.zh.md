---
description: "用给定字体把品牌名排版成单色 SVG 字标，尺寸适配 Web 壳侧边栏的品牌行。"
kind: "package-reference"
---

# @lyness/lyn-host-brand-wordmark

[English](README.md) | 中文

## 概述

把品牌名和一个字体文件变成 Web 壳画在图标旁边的字标。`typesetWordmark` 按字体的字距与字形替换规则排版品牌名，把字形转成一条填充为 `currentColor` 的路径，并把结果尺寸适配到 24px 高的侧边栏品牌行。产出的文档不含文本元素，也不引用字体，因此无论在哪里提供，显示效果都一致。无法产出可用字标的品牌名或字体会以固定的代码被拒绝。

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

这是一个库，不是插件：它不注册任何东西，也不读取配置。私有化部署的品牌工具调用它，把返回的文档写成 [`brand-deployment`](../brand-deployment/README.zh.md) 提供的 `wordmark` 文件。

### 最小用法

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { typesetWordmark } from '@lyness/lyn-host-brand-wordmark'

const font = new Uint8Array(await readFile('/srv/acme/fonts/Inter-SemiBold.woff2'))
const mark = typesetWordmark('acme', font)
await writeFile('/srv/acme/brand/wordmark.svg', mark.svg)
```

字体是一个 OpenType 文件：TTF、OTF、WOFF 或 WOFF2。请提供许可证允许把字形转成图形使用的字体；SIL OFL 许可的字体允许这样做。

### 文档保证什么

- 一个 `<svg>` 元素里只有一个填充为 `currentColor` 的 `<path>`，由嵌入方决定颜色，亮色或暗色主题都会随之变化。
- 坐标框高度恰好为 `WORDMARK_HEIGHT`（24），其 `width`、`height` 与 `viewBox` 一致，因此不写 CSS 也能按固有尺寸显示。
- 坐标最多保留两位小数；同样的品牌名和字体总是产出同样的文档。

坐标框的高度取字体的行框——从上伸到下伸，若有笔画超出则随之扩大——因此同一字体排出的所有品牌名，字母大小一致，与有没有上伸或下伸字母无关。宽度取排版后笔画的实际宽度。

### 拒绝情况

每一种拒绝都是一个 `WordmarkError`，调用方可以按其 `code` 分支处理：

| `code` | 原因 |
|---|---|
| `CONTROL_CHARACTER` | 品牌名含换行或控制字符。 |
| `UNREADABLE_FONT` | 这些字节不是 fontkit 能读取的字体文件。 |
| `FONT_COLLECTION` | 文件里包含多个字体；请只提供一个。 |
| `MISSING_GLYPH` | 字体缺少某个字符的字形；错误信息会逐个列出。 |
| `NO_VISIBLE_GLYPH` | 品牌名为空，或只有空格和不可见字符。 |
| `TOO_WIDE` | 字标宽于 `WORDMARK_MAX_ASPECT`（7:1），侧边栏最窄时会被截掉。 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

### 设计理念

`typesetWordmark` 先拒绝含控制字符的品牌名，然后打开字体，检查每个字符都有字形，再用 fontkit 排版。它从行框算出一个缩放比例，按该比例和字形在排版中的位置变换每个字形的轮廓并翻转 y 轴，把所有轮廓拼成一条路径，最后对每个数值取整。

### 为什么用 fontkit

排版引擎必须能读取开源字体实际发布所用的格式，并应用字体的字形替换表。fontkit 能读 TTF、OTF、WOFF 与 WOFF2，排版时应用字距与字形替换。在同一个字体上实测过的其他方案记在[决策记录](../../../.agents/notes/implemented/architecture/2026-09-15-wordmark-typesetting-with-fontkit.zh.md)里。

### 源码地图

- `src/index.ts` —— 整个库：常量、错误类型、打开字体与排版。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

想了解字标会被用在哪里、为什么用排版而不是生成，读这些。

- [brand-deployment](../brand-deployment/README.zh.md) —— 提供字标文件，并把它的 URL 发布给页面。
- [字标排版决策](../../../.agents/notes/implemented/architecture/2026-09-15-wordmark-typesetting-with-fontkit.zh.md) —— 引擎选型与实测过的其他方案。

-----

<a id="model-experience"></a>
## 模型体验

无。本库把品牌名和字体变成图形，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **本包不附带任何字体** —— 中文字体每个字重就有好几 MB，所以无论拉丁还是中文，调用方都要自己提供字体文件。
- **一个字标只用一个字体** —— 品牌名里的字符若不全在同一个字体中，比如用拉丁字体排中文，会被拒绝，而不是混用字体。
- **不选择可变字体的轴** —— 可变字体按其默认实例排版。
- **只支持单色** —— 文档只有一条 `currentColor` 路径，做不出双色字标。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作背景——点击展开</summary>

无。

</details>

**Runtime invariant:** 不发布伴随检查。本库不持有状态，也不注册任何东西，因此不存在可以被独立观察推翻的归属关系。
