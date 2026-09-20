---
description: "租户包分组：部署服务哪些租户，以及一个 HTTP 请求如何解析到其中恰好一个。"
kind: "package-group"
---

# tenant/ —— 租户目录

[English](README.md) | 中文

## 概述

租户是一个组织，其数据、配置与凭据与其他所有租户彼此分开。本组回答多租户的第一个问题：这个部署服务哪些租户，以及这个请求属于哪一个。能力缝是一个提供三种查法的目录——不可变 id、主机名、标识——配一个从组合配置读取的后端，以及一个应用本部署解析策略的 HTTP 调用方。不挂载本组任何内容的部署即单租户，harness 的其余部分毫无变化。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

<a id="packages"></a>
## 包

| 包 | 职责 |
|---|---|
| [`tenant`](tenant/README.zh.md) | 服务定义：`ctx.tenants` 目录，以及各面共享的租户词汇 |
| [`tenant-static`](tenant-static/README.zh.md) | 提供方：运营方写在组合配置里的租户清单，加载时校验 |
| [`tenant-config`](tenant-config/README.zh.md) | 服务定义：一个租户配置什么——模型、供应商、功能、身份、文案 |
| [`tenant-config-static`](tenant-config-static/README.zh.md) | 提供方：上述内容作为组合配置里的行，加载时校验 |
| [`tenant-http`](tenant-http/README.zh.md) | 调用方：解析一个 HTTP 请求属于哪个租户，并答复是哪一个 |
| [`tenant-session`](tenant-session/README.zh.md) | 调用方：在持久日志里给每个会话打上其租户与该租户的身份文本 |

<a id="related-documentation"></a>
## 相关文档

- [多租户子系统](../../docs/subsystems/multi-tenancy.zh.md)——租户词汇与解析顺序，含生成的服务参考。
- [brand-deployment](../host/brand-deployment/README.zh.md)——部署自有品牌，作用于整个部署而非单个租户。
- [webserver](../host/webserver/README.zh.md)——解析路由注册其上的 HTTP 载体。
- [能力缝](../../docs/glossary.zh.md#capability-seam)——本组据以拆分的服务定义／提供方／调用方三角。

<a id="dev-note"></a>
## 开发备注

无。
