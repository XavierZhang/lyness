# Agent Note：恢复包名中的产品段

Status: implemented

[English](2026-09-12-restoring-the-product-name-segment.md) | 中文

## Problem

改名最初把 harness 包发布为 `@lyness/<name>`，去掉了上游带有的产品段。上游正是靠这一段，把自家包与被它 vendor 并重命名进同一 scope 的框架分开：`@deepseek-ai/dsh-agent` 是 harness 包，`@deepseek-ai/cordis` 不是。凡是按名字给包分类的门禁，读的都是这个差异。

没有这一段，scope 什么也分不出来，而且会往两个方向失效。前缀变宽会把 vendored 与 Landlock 包族拉进发布包族，于是版本一致性与 MIT 许可证门禁去否决那些本就跟随自己上游版本线的包。用常量拼出的前缀则收窄为空集——`` `${LYNESS_PACKAGE}-` `` 变成 `@lyness/lyn-`，没有任何包匹配，于是 npm 安装布局门禁通过了，却什么也没验证。第二个方向才是危险的：它报告成功。

六处门禁需要手工排除，其中三处是一次上游同步带来的。这个代价不封顶，因为上游会继续加同类门禁，而每一处是绿还是红，取决于它的前缀往哪个方向坏，纯属偶然。

## Decision

harness 包带上产品段：`@lyness/lyn-<name>`。被重命名的 vendored 包保持 `@lyness/<name>`。结构就是上游的结构，只换了名字。

`rebrand.ts` 用一条规则表达这件事（`pkg-scope`：`@deepseek-ai/dsh-` → `@lyness/lyn-`），而读取 `@lyness/lyn-llm-deepseek` 与 `@lyness/cordis` 的那两条后置断言，保证这个区分在每次重放后仍然成立。

## Alternatives considered

**继续去掉产品段，逐个门禁手工排除。** 包名不变，而且那六处排除本就已经写好了。但它接受一个随上游门禁数量增长而不封顶的代价，且无法靠评审兜住：前缀收窄为空集的门禁是**通过**的，因此失效恰好在最要紧的时候不可见。

**全部改为按位置而非按名字分类。** `vendor/`、`native/`、`website/` 都是诚实的信号，许可证门禁用的正是这个。但这要求永久地改写上游每一处按名字分类的门禁；而且当分类发生在运行时、针对一棵已安装的树而非 workspace 时，位置信息并不存在。

**给 vendored 包单独一个 scope。** `@lyness-vendor/cordis` 能恢复区分，又不用加长 harness 包名。但它比改名所需的程度更远离上游：上游只有一个 scope 而我们有两个，意味着 vendoring 流程、rescope codemod、以及每一份写有 peer 依赖的 manifest 都不再与上游同形，而这份不同形要在此后每次同步时再对齐一遍。

## Consequences

有三条 codemod 规则只为掩盖去掉产品段带来的问题而存在，现已删除：显示前缀剥离规则、拆分片段路径规则，以及裸转义 scope 规则。形如 `join(modules, '@scope', 'dsh-desktop-host')` 的路径现在经由普通的 scope 与 token 规则就能改对——而那正是被删掉的特例一直没做到的事。规则从 21 条减到 18 条。

六处门禁排除全部回退。上游的检查逐字生效，`hygiene` 在对它们零改动的情况下通过。desktop 的 package-set 夹具也一并回退：`lyn` 排在 `lyn-base` 与 `lyn-desktop-host` 之前，与 `dsh` 当年完全一致。

凡是 token 改名深入名字内部的地方，排序仍然会变——`subagent_lyn_sdk` 排在 `subagent_fork` 之后，而 `subagent_dsh_sdk` 排在它之前。工具 schema 期望文件、一处内联快照的键序、两处文档中文侧的顺序，需要在每次重放后手工修正；fork 台账里的重放收尾清单点明了它们。

包名变长了。`@lyness/lyn-agent` 读起来是冗余的，而门禁依赖的正是这份冗余。
