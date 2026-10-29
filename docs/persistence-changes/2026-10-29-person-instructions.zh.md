---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-29-person-instructions

[English](2026-10-29-person-instructions.md) | 中文

## 概述

新增 `person/instructions` 会话事件：这段会话跑在谁的指令之下，以及那段文本的原文。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-29-person-instructions
baseline: false
changes:
  - root: "event:person/instructions"
    previous: null
    after: "04968946798e4e967c48aec7dab6a73f58e8e5a2979bb2b0edd98a84ee327828"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

这是一个新的事件根，已有记录一概不变。不认识这个类型的读者会忽略它：该事件只用于日志侧的归属与还原，没有任何读者必须折叠的投影依赖它，而它所描述的提示词本已可从记录在案的 `system/message` 还原。本版本的写入方只对「创建者发布了身份」的会话写它，于是没有这条事件的日志读作「没有人开的会话」，而不是读作「记录缺失」。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/identity/personal-instructions packages/api/personal-instructions-controller：32 个测试通过。pnpm run doc-sync：44 道门禁通过。

<a id="dev-note"></a>
## 开发备注

无。
