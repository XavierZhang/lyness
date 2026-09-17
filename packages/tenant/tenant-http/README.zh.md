---
description: "解析一个 HTTP 请求属于哪个租户——按租户请求头、主机名或子域名标识——并答复是哪一个。"
kind: "package-reference"
---

# @lyness/lyn-tenant-http

[English](README.md) | 中文

## 概述

本插件应用一个部署的租户解析策略：先看网关设置的 `X-Tenant-ID` 请求头，再看请求到达的主机名，最后看所配置基础域名的直接子域名所携带的标识。它注册一条路由，答复发起请求的一方属于哪个租户，并拒绝解析不到租户的请求。它从不列出租户清单，因此调用方得不到超出自身请求已指明范围的信息。`resolveTenant` 已导出，供其他调用方使用。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```yaml
- id: tenant-http
  name: '@lyness/lyn-tenant-http'
  config:
    path: /tenant
    baseDomain: tenants.example.com
```

`path` 默认 `/tenant`，位于 `/api` 之外——后者由浏览器连接整体占用。`baseDomain` 可选：不配置时不解析任何子域名。

```console
$ curl -s -H 'Host: acme.example.com' localhost:8080/tenant
{"id":"acme","slug":"acme","displayName":"Acme","source":"host"}
```

### 解析顺序

| 顺序 | 来源 | 规则 |
|---|---|---|
| 1 | `X-Tenant-ID` | 声明的 id 优先。未知或格式不合法的 id 解析为无——它不会继续回落到主机名，因为声明了租户的调用方不能被静默地服务成另一个租户。空白或重复的请求头视为没有声明。 |
| 2 | `Host` | 去掉端口并小写后的主机名，按某个租户声明的归属匹配。 |
| 3 | 子域名 | `baseDomain` 正下方的一个标签，与租户标识匹配。`example.com` 下的 `a.b.example.com` 不指向任何租户。 |

解析不到租户的请求以 `404` 与 `{"error":"unknown-tenant"}` 答复。没有兜底租户：租户是隔离边界，服务成另一个租户比什么都不服务更糟。

### 请求头何时可信

只有当本部署前方有组件设置 `X-Tenant-ID` 并剥离入站的同名头时，它才是权威的。可被直接访问的部署不得按"网关会设置该头"的假设组合本插件；那种情况下可信的来源是主机名。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

[`src/resolve.ts`](src/resolve.ts) 是对目录与请求头表的纯函数——上面的顺序，加上主机名与子域名解析——因此另一个调用方（RPC 面、会话标记方）无需路由即可应用同一策略。[`src/index.ts`](src/index.ts) 拥有传输部分：在 `ctx.effect` 内经 `ctx.webServer.register` 注册一条精确路由、JSON 答复、写操作返回 `405`，且响应不缓存。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——本调用方读取的目录。
- [tenant-static](../tenant-static/README.zh.md)——主机名或标识据以匹配的租户清单。
- [webserver](../../host/webserver/README.zh.md)——路由注册其上的载体。

-----

<a id="model-experience"></a>
## 模型体验

无，因为解析是 host 侧的路由身份；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **该路由不做鉴权** —— 它只答复发起请求的一方，且答复内容正是该请求自身的主机名或请求头已指明的租户，但它自己不做任何会话或令牌校验。
- **解析止于答复** —— 没有任何机制把已解析的租户带进 RPC 网关或会话日志；那些调用方出现后自行调用 `resolveTenant`。
- **只有一个基础域名** —— 在多个域名下服务租户的部署，改为在清单里逐个声明主机名。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。插件持有一条由其 fiber 拥有的路由注册，每个答复都由一个请求与当时的目录推导得出。
