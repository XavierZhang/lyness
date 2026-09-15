# Agent Note：Web 客户端绘制 lyness 品牌，并让位于部署品牌

Status: implemented

[English](2026-09-15-lyness-brand-in-the-web-client.md) | 中文

## Problem

Web 客户端仍在绘制 DeepSeek 鲸鱼。没有包占据侧栏标志与会话首屏的 slot 时，它们回退为鲸鱼；唯一的填充 `@lyness/lyn-client-ui-brand-official` 只在 `official` 构建中注册，画的也是鲸鱼。通过 `@lyness/lyn-host-brand-deployment` 配置了自有品牌的私有化部署，服务端 HTML 里的标题与 favicon 会被替换，但客户端随后仍在侧栏画鲸鱼，`AppFrame` 还会用构建期的 `LYNESS_CLIENT_TITLE` 覆盖浏览器标题。两个 favicon、文档站字标与 powered-by 徽章上也都是鲸鱼。

## Decision

`@lyness/lyn-client-ui-brand-lyness` 在所有构建中占据 `sidebar.brand.mark`、`sidebar.brand.name` 与 `conversation.hero.brand.mark`，Web 应用 bundle 用它取代 `ui-brand-official`。它的图形是本 fork 自有工具链产出的路径数据：`lyn-brand-icon` 从 lyness 图标 PNG 描出标志，`lyn-brand-wordmark` 用 Inter SemiBold 排出字标。两者都以 `currentColor` 填充。

每个填充在渲染时读取 `globalThis.lynDeploymentBrand`，由部署逐项替换 lyness 图形：标志 URL 替换两处标志；名称优先显示字标 URL，其次以文本显示产品名，否则显示 lyness 字标。该全局值是脚本写入的页面数据，因此逐个成员检查：非字符串或空字符串的成员，以及不是页面同源路径的 URL，一律视为缺失。`AppFrame` 在同样的检查下，优先使用部署产品名而非 `LYNESS_CLIENT_TITLE`。

两个 favicon、文档站的图标字标组合与徽章 PNG 原地替换。Shields.io 徽章通过新增的 rebrand 规则 `shields-logo` 去掉 logo 参数，因为 Simple Icons 没有 lyness 的 logo。

## Alternatives considered

**在 `lyn-client-ui-primitives` 里重画鲸鱼组件。** 所有回退都会改变，且无需新包。这些组件是上游文件，每次同步上游都会在它们上面冲突，而官方包会继续画上游下一次发布的图形。

**像 `ui-brand-official` 那样按构建 profile 门控填充。** 开发构建会保留侧栏的构建版本标签。它们也会保留鲸鱼——正是本次要移除的图形——而且部署品牌到达不了开发构建。

**通过 RPC 获取部署品牌。** 客户端将不依赖页面全局值。品牌在客户端启动前就已在页面里，一次请求只会为页面本就携带的数据增加加载态与失败路径。

**让 `ui-brand-official` 与新包同时挂载。** 官方包仍可服务 `official` 构建。品牌 slot 只容一个填充，两个包会竞争，后注册者胜出。

## Consequences

开发构建的侧栏不再显示构建版本标签，因为名称 slot 在所有构建中都被占据。

`ui-brand-official` 留在仓库中但不挂载，上游对它的改动仍能干净合并。

有四类上游文件与上游不同：`AppFrame.tsx` 及其测试、Web 应用 bundle 的插件名单、被替换的图片文件、徽章测试里钉住的哈希。合并方法会先把树重置为上游，再恢复 fork 文件，因此每次同步后都必须恢复这些图片文件与哈希；`CUSTOM.md` 列出了它们。

rebrand 规则现在可以删除文本。`--reverse` 会跳过这类规则，因为空的搜索串会在每两个字符之间都匹配。
