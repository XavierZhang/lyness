---
description: "记忆组导览：agent 在会话之间带着的持久事实，面向浏览该组的使用者与维护者。"
kind: "package-group"
---

# memory/ —— 持久 agent 记忆

[English](README.md) | 中文

## 概述

记忆组跨会话保留事实——关于一个工作区及其中的人的约定、偏好与其他长期细节——并把它们作为运行时上下文折进之后的每个请求。写入是显式的：由人或 agent 要求记住某件事，组里没有任何东西去读会话记录并自行决定。记忆体量小、可变、在工作中写下，这正是它与知识库所索引的文档的分界。本页是该组的导览；逐包契约归包 README 所有。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 作用 | ctx key |
|---|---|---|
| [`memory/`](memory/README.zh.md) | 带显式写入路径、保留上界与运行时上下文贡献的持久事实；`./tools` 追加面向模型的写入、列出与移除工具 | `ctx.memory` |

-----

<a id="related-documentation"></a>
## 相关文档

- [记忆子系统](../../docs/subsystems/memory.zh.md) —— 作用域、治理，以及记忆与知识库的区别。
- [记忆、检索与提示词组装](../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.zh.md) —— 决策记录，含本组刻意不做的事。
- [生成的配置目录](../../docs/config-catalog.zh.md) —— 该组各包接受的全部配置字段。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
