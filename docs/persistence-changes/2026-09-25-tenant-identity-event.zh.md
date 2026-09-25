---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-09-25-tenant-identity-event

[English](2026-09-25-tenant-identity-event.md) | 中文

## 概述

新增 tenant/identity 会话事件，记录会话所属的租户以及该租户贡献的身份文本。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-09-25-tenant-identity-event
baseline: false
changes:
  - root: "event:tenant/identity"
    previous: null
    after: "0b15140ccd5df3d1f62e93067131f0e738b3302ffcb4c6dc87cb10d802238d71"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有记录仍然有效：它们只是没有 tenant/identity 事件，而每个投影都会把缺失的记录折叠为 null。该事件是仅落日志的归属信息，不会进入模型对话记录，因此没有它时回放与组装出的系统提示词都不变。信封没有把该事件标为可忽略，所以不认识该类型的构建会按仓库默认拒绝该日志；该类型随组合出此事件的租户包一同分发，没有其他组合会写入它。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/tenant/tenant-session/tests：9 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
