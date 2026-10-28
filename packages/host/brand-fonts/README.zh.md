---
description: "平台内置的字标字体 Inter SemiBold 与 Noto Sans CJK SC Medium，按回退顺序排列，采用 SIL Open Font License；供品牌工具调用方与维护者阅读。"
kind: "package-reference"
---

# @lyness/lyn-host-brand-fonts

[English](README.md) | 中文

## 概述

品牌方未提供自有字体时，平台用于排版字标的字体。它们只服务于品牌字标：字体文件在 host 上读取，字标以轮廓形式分发，没有任何字体到达浏览器。`loadBrandFonts` 按回退顺序返回 Inter SemiBold 与 Noto Sans CJK SC Medium，可直接交给 `typesetWordmark`，后者把每个字符排进第一个能绘制它的字体。两者合起来可绘制英文及其他拉丁字母名称、希腊文、西里尔文、中文、日文与韩文。两个文件均按 SIL Open Font License 1.1 原样分发，许可证文本随附在旁。

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

这是库而不是插件：它不注册任何内容，也不读取配置。

```ts
import { loadBrandFonts } from '@lyness/lyn-host-brand-fonts'
import { typesetWordmark } from '@lyness/lyn-host-brand-wordmark'

const mark = typesetWordmark('领驭 lyness', loadBrandFonts())
```

| 字体 | 平台依赖它绘制的文字 |
|---|---|
| Inter SemiBold 4.1 | 拉丁字母（含英文与越南文）、希腊文、西里尔文 |
| Noto Sans CJK SC Medium 2.004 | 中文、日文假名与汉字、韩文 |

Inter 排在前面，因此即使 Noto Sans CJK 也能绘制拉丁字母，拉丁字母仍保持 Inter 的字形。两个字重经过挑选，使名称混排多种文字时笔画粗细看起来一致。

SaaS 租户只使用这些字体。私有化部署的品牌方可以改用自有字体，通过 `lyn --profile brand-studio --font` 提供。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`fonts/` 存放两个字体文件及其许可证文本，均取自上游发布、未经修改。[`third-party-assets.json`](third-party-assets.json) 记录每个文件的名称、版本、许可证、许可证文件、来源发布与 SHA-256。`scripts/gen-third-party-notices.ts` 读取每个包的记录，校验每个校验和与许可证，拒绝未被任何记录列出的字体文件，并在 `THIRD_PARTY_NOTICES.md` 中列出这些文件。[`src/index.ts`](src/index.ts) 以 `BRAND_FONTS` 暴露这些文件，并由 `loadBrandFonts` 读取。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [brand-wordmark](../brand-wordmark/README.zh.md)——跨这些字体排版名称。
- [brand-studio](../../bundle/brand-studio/README.zh.md)——运营方未提供字体时使用这些字体。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只随附用于图形的字体文件，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **汉字只有一种地区字形** —— 日文汉字与繁体字按简体中文字形绘制，细节上与日本、繁体中文及韩国的书写习惯不同。
- **不支持从右到左与复杂文字** —— 阿拉伯文、希伯来文、泰文与印地文名称会被拒绝，直到为它们验证过字体与排版。
- **只有一个字重** —— 所有内置字标都是 SemiBold 拉丁字母搭配 Medium 中日韩字形。
- **包体积** —— Noto Sans CJK 文件为 16.5 MB。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

替换字体时只能使用未经修改的上游发布，并在同一改动中更新 `third-party-assets.json` 里的版本、来源与 SHA-256。

</details>

**运行时不变式：** 不发布伴生入口。本包不保留状态、不注册任何内容，因此不存在可能被独立观察推翻的归属关系。
