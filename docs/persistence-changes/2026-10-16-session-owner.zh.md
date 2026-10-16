---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-16-session-owner

[English](2026-10-16-session-owner.md) | 中文

## 概述

新增 `session/owner`：一次性记录谁开启了这个会话，以及他开启它时所处的身份。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-16-session-owner
baseline: false
changes:
  - root: "event:session/owner"
    previous: null
    after: "6d5b72b6153d90f7cb549610592cd49e034a721f50f99b5b5e3ae89460fb6279"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

对认识该事件的读取方向后兼容：既有日志里没有它，读作「无归属」；记录在创建时写入一次，不改写任何日志。一个不认识该类型的构建会拒绝这份日志，而不是在没有归属的情况下把一场对话端出来——在托管部署上这正是期望的保护。在请求 principal 之外开启的会话（CLI 运行、子 agent、入站 webhook）不带该记录，而「缺席」意味着无归属、不是未知。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/identity/session-ownership：8 个测试通过，其中一条经真实 Loader 的组合测试证明：签入调用内创建的会话被归属，调用之外创建的不被归属。

<a id="dev-note"></a>
## 开发备注

无。
