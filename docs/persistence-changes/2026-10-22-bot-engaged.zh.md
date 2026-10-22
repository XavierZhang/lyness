---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-22-bot-engaged

[English](2026-10-22-bot-engaged.md) | 中文

## 概述

新增 bot/engaged 日志事件，记录一场会话以哪个 bot 的身份说话，以及它当时运行所用的那段性格。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-22-bot-engaged
baseline: false
changes:
  - root: "event:bot/engaged"
    previous: null
    after: "1d814f0805d00b9a45432779ad907e42e4be779ed300abbbe36a552356d2776d"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有记录仍然有效：这是一个新事件，从未以 bot 身份开启的会话不带它。不认识这个类型的构建会拒绝该日志，而不是在缺少模型所见那段性格的情况下读这场对话——这正是预期的读法：性格会进入模型，一个默默丢掉它的读者会把说过什么、在什么提示词下说的都报错。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/identity/managed-bots packages/api/session-controller：912 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
