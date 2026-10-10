---
description: "厂商组导览：一个外部厂商一个包，贡献身份面、渠道面或两者，面向接入厂商的使用者与新增厂商的维护者。"
kind: "package-group"
---

# vendor/ —— 外部厂商集成

[English](README.md) | 中文

## 概述

厂商组为部署所接入的每一个外部厂商持有一个包。一个厂商可以贡献两个面：**身份面**让人登录进来，**渠道面**接收它的事件并投递回复。两个面都有的厂商共享同一份应用凭据与同一条 token 刷新路径，这正是包按厂商而不是按面划分的理由。微软是第一个：Entra ID 是它的身份面，而 Teams 将是它的渠道面，用同一份注册。逐包契约归各自的包 README 所有。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 作用 | ctx key |
|---|---|---|
| [`microsoft-entra/`](microsoft-entra/README.zh.md) | Microsoft Entra ID 的浏览器登录及它确立的已验证主体——微软集成的身份面 | `ctx.microsoftEntra` |

-----

<a id="related-documentation"></a>
## 相关文档

- [厂商集成](../../docs/subsystems/vendor-integrations.zh.md) —— 两个面、它们共享什么，以及一个厂商包拥有什么。
- [活儿如何到达 agent，以及它落在的那一个会话平面](../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.zh.md) —— 决策记录，含身份面与渠道面为何同处一个包。
- [生成的配置目录](../../docs/config-catalog.zh.md) —— 该组各包接受的全部配置字段。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
