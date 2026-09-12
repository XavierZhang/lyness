# Agent Note：lyness 品牌替换 codemod

Status: implemented

[English](2026-08-31-lyness-rebrand-codemod.md) | 中文

## Problem

二开以自己的身份发布，因此上游产品持有的每一个名字都必须迁移：npm scope、CLI 命令、家目录、环境变量前缀、显示名与仓库 URL。约 6000 个文件中的 4 万行带有其中之一。

手工改名是一次性动作。上游仍在演进，每次同步都会把上游名字重新带回它触及的地方。无法重放的改名会退化为永久的合并成本。

两个名字还会冲突。`DeepSeek` 在 `DeepSeek Harness`、`deepseek-harness` 与 `@deepseek-ai` scope 中指 harness，在 `llm-deepseek`、`api.deepseek.com` 与供应商引导文案中指**模型供应商**。触及后者的改名会悄悄毁掉产品调用模型的能力，同时通过所有类型与 lint 门禁。

## Decision

[`scripts/rebrand.ts`](../../../../scripts/rebrand.ts) 沿用 [`rescope-vendor.ts`](../../../../scripts/rescope-vendor.ts) 的形态：有序字面量规则、保护路径清单、后置断言与 `--check` 模式。上游同步后重跑它就是维护流程。

每条规则都写成无法匹配模型供应商：各自要求 `Harness` 一词、`-harness` 后缀或 scope 的尾斜杠。没有任何规则匹配裸 `DeepSeek`。两条后置断言确认供应商幸存，因为这种失败对其他所有门禁都不可见。

规则顺序是承重的。`repo-url` 先于 `slug`，URL 才能保住 owner 段；`env-prefix` 先于 `abbreviation`，`DSH_HOME` 才会成为 `LYNESS_HOME` 而非 `LYN_HOME`；`pkg-scope` 先于 `vendor-scope`，`dsh-tool-cordis` 才不会被读作 vendored 包。

### 词边界的含义

裸 `dsh` 词元仅在两侧有小写字母时拒绝匹配。把所有标识符字符都当作边界虽能保护 `handshake`，却也会拒绝 `dshHome`、`dsh_home`、`__dsh_main__` 与 `subagent_dsh_sdk`——它们同样带有品牌。大小写变化、下划线与连字符仍是边界。

三类站点对任何词元规则都不可见，各自成为一条窄规则并携带原因：分隔符被转义的正则字面量、由组件文案与 id 拼接而成的标签、以及含义取决于共享产品前缀的 fixture 名。没有转义正则那条规则，scope 与词元规则会各改一半，产出 `@lyness\/lyn-`——一个没有任何包持有的前缀。

### 路径与文本一同迁移

配置与文档按路径寻址工作区目录和 Agent Note，因此只改内容的改名会让 `tsconfig.host.json` 指向不存在的目录。每次运行都通过 `git mv` 按同一套规则重命名被跟踪的路径。二进制文件按内容判定而非扩展名：扩展名白名单会静默跳过它遗漏的一切，而这些名字会出现在样式表、JSON Lines fixture 与一个依赖 patch 中。

### 归档 Agent Note 保持冻结

`archived/manifest.json` 按内容哈希封存每个归档产物且只追加，因此变更过的内容是工具没有路径接受的错误。归档树豁免于所有规则，指向它的引用在规则生效前被屏蔽，使被改写文档中的链接仍能解析。地址只有在能解析时才有意义，因此它与被寻址的对象一同冻结。

`vendor/README.md` 仅豁免于 URL 规则。它记录每份固定拷贝来自哪个上游仓库与提交；改写这些 URL 等于声称该框架 vendored 自本二开仓库。

## Alternatives considered

**手工改一次名。** 这是拿到改名后代码树最快的路，它落选的理由就写在上面的 Problem 里：上游一直在动，每次同步都会在它碰过的地方重新引入上游名字。一次无法重放的改名，是每次合并都要重付的成本，且随间隔增长。

**一次无序的全局查找替换。** `DeepSeek` 既指 harness，也指模型供应商。无序的替换会波及 `llm-deepseek`、`api.deepseek.com` 与供应商引导文案，破坏产品调用模型的能力，却能通过所有类型、lint 与构建门禁——一种不可见的失败。给规则定序、并要求每条规则都包含 `Harness`、`-harness` 或 scope 的结尾斜杠，才使供应商不可达。

**按扩展名决定改写哪些文件。** 允许名单易读，也会静默跳过它遗漏的一切。这些名字出现在样式表、JSON Lines 夹具、web manifest 和一个依赖补丁里，与出现在 TypeScript 中一样频繁。改为读取内容，就不会遗漏任何人没预料到的文件类型。

**把所有标识符字符都当作词边界。** 它保护了 `handshake`——正是这个例子促成了词边界的存在。但它同时拒绝 `dshHome`、`dsh_home`、`__dsh_main__` 和 `subagent_dsh_sdk`，而这些都带着品牌、必须跟随改名。只有小写字母才延续一个词；大小写变化、下划线、连字符与数字都是边界。

## Consequences

从包名中去掉产品段，代价是丢失了仓库依赖的一个区分。`@deepseek-ai/dsh-*` 曾把 harness 包与 vendored 的 `@deepseek-ai/cordis` 家族分开；`@lyness/agent` 与 `@lyness/cordis` 在名字上已无法区分。三处按名字前缀的判断改用位置：许可证门禁与包依赖图排除 `vendor/`，插件清单显示名不再剥离一个不可能出现的前缀。位置是更好的信号——包的许可证取决于谁写的，不取决于它叫什么。

排序输出会重排。工具目录按名字排序，`subagent_lyn_sdk` 排在 `subagent_fork` 之后，而 `subagent_dsh_sdk` 曾排在它之前，因此仅就地改写字符串的期望文件还需要重新排序。

`--check` 看不见被它自己的边界规则拒绝的匹配。残留检测共用同一套规则，因此被相邻小写字母挡住的词元读起来就是「无残留」。这种规模的改名需要一次不带边界的剩余拼写普查，而不只是一个通过的检查。
