---
description: "一个部署对使用它的人说的话，面向撰写更新日志的实施方与新增来源的维护者。"
kind: "package-reference"
---

# @lyness/lyn-announcements

[English](README.md) | 中文

## 概述

`lyn-announcements` 是一个部署自己的更新日志与通知所在之处。`./static` 提供实施方写在组合配置里的那些，按最新在前，客户端经公告控制器读取它们。每条公告自带它所描述的版本，而不是由服务报告某一个「当前版本」：宿主推断不出一个它敢担保的版本，而最新那条公告的版本是这个部署确实声明过的。一个没挂任何来源的部署没有话要说——单操作者安装就是这样。

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

```yaml
- id: announcements
  name: '@lyness/lyn-announcements/static'
  config:
    announcements:
      - id: v0-1-7
        version: '0.1.7'
        publishedAt: '2026-10-15T08:00:00.000Z'
        title: '0.1.7'
        body: |
          - Administrators can grant credits
          - Sign-in through a company directory
        url: https://example.com/releases/0.1.7
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `announcements` | `[]` | 这个部署已经发布了什么 |
| `announcements[].id` | 必填 | 稳定身份；选定一次、永不复用 |
| `announcements[].publishedAt` | 必填 | 发布时刻，UTC |
| `announcements[].title` | 必填 | 列表展示的那一行 |
| `announcements[].body` | 必填 | 公告本身，Markdown |
| `announcements[].version` | — | 它所描述的版本；通知类则省略 |
| `announcements[].url` | — | 别处的完整说明 |

空列表是一个完整的答案——这与名册不同，名册为空会把所有人挡在外面。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**排序在这里完成，而不是在界面。** `published()` 按最新在前作答，于是每个界面对「最新」的理解一致；一份由各读者自行排序的列表，就是会被两个读者排成两样的列表。两条在同一时刻发布的公告退回到按身份比较，于是它们的顺序是固定的，而不会在两次读取之间互换。

**两种拒绝发生在加载时。** 一个无法解析的 `publishedAt` 会排成 `NaN`，把那条公告放到任意位置；两条共用一个身份会让「读者关掉的是哪一条」变得含糊。两者都在实施方正看着那个文件时失败。

**版本属于公告自己。** 一个部署身后有许多次发布、每次发布对应一条公告，而一条不关于发布的通知根本没有版本——所以它是每条公告的字段，而不是服务报告的那一个。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-api-announcement-controller`](../../api/announcement-controller/README.zh.md) —— 客户端如何读取它们。
- [`lyn-client-ui-settings-announcements`](../../client/ui-settings-announcements/README.zh.md) —— 渲染它们的那一行与那个阅读器。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它把部署方撰写的文本提供给界面。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **还没有托管形态的来源** —— `./static` 是「独立安装」形态的答案。托管部署发布公告时不会去改客户的配置，那需要一个以存储为后端的来源。
- **没有已读状态** —— 没有任何东西记录某个人看过哪些公告，所以界面无法把某一条标成未读。
- **写下的公告需要重启** —— `./static` 在加载时读取它的列表，所以实施方发布一条公告是改组合配置。
- **没有定时** —— 一条公告在写下的那一刻就已发布；`publishedAt` 写在未来也照样提供。

**Runtime invariant:** 不发布任何 companion。这份列表是本包持有的一个值，所以不存在可能分歧的两份独立观察。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`newestFirst` 先复制再排序，所以调用方的数组绝不会在它脚下被重排。有一个测试把这一点钉住。

</details>
