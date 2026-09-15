# Agent Note：brand-studio 是编辑补丁层的独立 profile

Status: implemented

[English](2026-09-15-brand-studio-profile.md) | 中文

## Problem

私有化部署通过 `brand-deployment` 行给自己换品牌：一个存放标志、字标与 favicon 的资产目录，加上一个指向它们的补丁层。手工准备这些输入，意味着要写出能通过品牌语法的 SVG，以及 Loader 能接受的 YAML。描边与排版已经有了库，但没有运营方能直接运行、把它们接到这一行上的东西。仓库只允许以 `lyn` profile 形式存在的 Node 应用，因此独立脚本或包 bin 都不可行。

## Decision

`@lyness/lyn-brand-studio` 是一个以 `lyn --profile brand-studio` 启动的 bundle，其 patch 只插入一行，且不叠加在 `lyn-base` 之上。该行用 commander 解析 launcher 传入的参数，运行一次，并经 `ctx.appExit` 请求退出。它以参数接收产品名、图标 PNG、字体文件、可选的主题色、资产目录与目标 profile；不带 `--accept-trademark` 与 `--accept-font-license` 时拒绝运行。

一次运行会先校验颜色、描边图标、排版名称、用 `isBrandSvg` 检查每个 SVG，并组装好新的补丁层，然后才写入任何内容。随后写出三个 SVG，最后才写补丁层，因此会在补丁层变化时重载的 `lyn web` 永远不会读到指向缺失文件的行。它编辑的是目标 profile 自己的补丁层，默认 `web`；从未启动过的随附 profile 会先被初始化，与其首次启动时的做法相同。补丁层通过 `yaml` 的文档模型编辑：在每个 `brand-deployment` 行上设置本工具负责的键，其他键、其他行、注释与 `!!js` 值保持原样。

私有化部署的品牌方提供自己的字体，运营方以 `--accept-font-license` 确认其字体授权允许把字形用于 logo。本工具只在运营方的服务器上读取字体，既不复制也不分发该文件；它写出的字标是轮廓图形，不是字体软件，因此平台不因该字体的许可证承担任何义务。SaaS 租户不能提供字体，因为租户不上传任何文件；平台内置字体交付后，他们使用内置字体。

## Alternatives considered

**把该行写进 home 补丁层。** 一个文件就能给所有 profile 换品牌。但它也会作用于 `brand-studio` 自身以及所有没有 `brand-deployment` 行的 profile，这些 profile 每次启动都会记录目标行不存在。

**用 js-yaml 解析再输出补丁层。** Loader 本就用它读取补丁层，它也保留 `!!js` 标签。但它会丢弃注释，运营方写在补丁层里的备注会在第一次运行后消失。

**缺少输入时交互式询问。** 引导式询问在首次使用时更友好。仓库没有任何终端询问代码，而只用参数能让命令保持可脚本化，并能通过真实启动来测试。

**只接受内置字体。** 所有字标都将来自平台随附并披露的字体。但品牌方的字体是其身份的一部分，私有化部署可以在平台不分发它的前提下使用；内置字体服务于 SaaS 租户以及没有自有字体的运营方。

**在 Web 应用里做设置页。** 这样不需要服务器权限。但部署的身份不是应用使用者可以更改的，这与品牌不放在 `settings.yaml` 的理由相同。

## Consequences

`lyn-app-boot` 的 `PROFILE_TEMPLATES` 新增 `brand-studio` 条目，`apps/cli` 依赖该 bundle，因此随附 profile 的测试与 `docs/architecture.md` 的应用清单也都列出了它。

`lyn-host-brand-deployment` 导出 `isBrandColour`，于是本工具会在写入任何文件之前，拒绝部署加载时同样会拒绝的颜色。

重新序列化补丁层可能会规范化本工具未触及的行的引号与空行。

AI 生成路径、交互式询问与平台内置多语言字体仍待完成；其中第一项需要图像生成能力。
