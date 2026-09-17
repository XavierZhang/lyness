# Agent Note：Python 导入包名改用 fork 自己的名字

Status: implemented

[English](2026-09-17-python-package-rename.md) | 中文

## Problem

改名 codemod 已把 Python 发行包改名为 `lyness-sdk` 与 `lyness-runtime-bin`，但没有任何东西改调用方 import 的名字。SDK 仍然安装出名为 `deepseek_harness` 的模块，随附运行时仍然是 `deepseek_harness_runtime`，于是 fork 的使用者要对着一个以别的名字发布的包写 `from deepseek_harness import DeepSeekHarness`。

同一处拼写早已让发布流程失效。wheel 文件名就是把发行名中的连字符换成下划线，因此构建产出的是 `lyness_sdk-<版本>-py3-none-any.whl`，而 `.gitlab-ci.yml`、GitHub 工作流、`scripts/build-python-release.py` 与开发指南仍断言 `deepseek_harness_sdk-…` 与 `deepseek_harness_runtime_bin-…`。没有门禁发现它，因为没有任何门禁会真的构建 wheel。

`python/sdk/uv.lock` 也同样陈旧：codemod 把它作为生成文件保护起来，而 `pnpm install` 不会重算它，于是它仍然钉着 `deepseek-harness-sdk` 与 `deepseek-harness-runtime-bin`——两个清单里都已不存在的名字。

## Decision

新增一条 codemod 规则 `python-package`，把 `deepseek_harness` 改为 `lyness`。由于运行时模块名与 wheel 名中的记号都是这同一个字符串加后缀，这一条规则同时产出 `lyness_runtime`、`lyness_sdk` 与 `lyness_runtime_bin`。codemod 原有的路径改名过程用 `git mv` 移动两个包目录，因此模块与引用它们的清单一起移动。

`uv lock --project python/sdk` 重新生成锁文件，`CUSTOM.md` 的改名收尾清单新增这一步：codemod 不能碰的生成文件，必须由生成它的工具重写。

下划线拼写只可能指 harness。模型供应商的包名与端点都不含下划线，这正是这条规则无需边界判定的原因。

## Alternatives considered

**保留上游的导入名。** 什么都不用改，照着上游写的代码也继续可用。但那样 fork 发布的 `lyness-sdk`，其 import 行写的却是另一个产品的名字，而且 wheel 文件名对不上的问题还要另行修复。

**手工改这些文件。** 对这个规模的改名（约 113 行）零件更少。但同步上游时会先把工作树重置为上游再重放 codemod，手工改动会在下次合并时丢失；只有规则能被重放。

**拆成两条规则，各管一个模块。** `deepseek_harness` 与 `deepseek_harness_runtime` 各自写出自己的目标。但后者是前者的后缀，一条字面规则已经覆盖两者；拆成两条反而要靠顺序约定，才不会产出 `lyness_harness_runtime`。

## Consequences

SDK 使用者 import `lyness` 与 `lyness_runtime`。这一改动与上游不再源码兼容；由于这两个包仍是预发布版本（`0.0.0.dev0`），不存在任何已发布版本以 fork 的名字带着旧导入路径。

发布工作流现在写的是构建真实产出的文件名。这条路径在此仍未被验证：没有门禁构建 wheel，因此下一次发布才是第一次确认。

`uv.lock` 由 `uv` 重新生成而不是被 codemod 改写，这让 `uv` 始终是自己锁文件的唯一写入方，也使这一步成为同步之后不能忘的清单项。
