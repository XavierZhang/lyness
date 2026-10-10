# 厂商集成

[English](vendor-integrations.md) | 中文

部署所接入的每一个外部厂商一个包，贡献身份面、渠道面或两者。[Microsoft Entra 契约](../../packages/vendor/microsoft-entra)拥有第一个身份面；决策记录是[活儿如何到达 agent，以及它落在的那一个会话平面](../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.zh.md)。

Sources: [`packages/vendor/microsoft-entra/src/types.ts`](../../packages/vendor/microsoft-entra/src/types.ts) · [`packages/vendor/microsoft-entra/src/protocol.ts`](../../packages/vendor/microsoft-entra/src/protocol.ts)

## 两个面，一个包

**身份面**让人登录进来并回答他是谁。**渠道面**接收该厂商的事件并投递回复。

它们同处一个厂商包，是因为它们共享厂商只签发一次的东西：一份应用注册、它的密钥或公共客户端身份，以及让两者继续可用的那条 token 刷新路径。按面拆开会给这份凭据安上两个所有者。对微软来说这个拆分根本不可能成立：Teams 的机器人令牌由 Entra 签发，所以渠道面无法脱离身份面单独建起来。

只贡献一个面的厂商是常态。Entra 今天单独出厂；渠道面在客户需要时才到来。

## 一个身份面确立了什么

一个经过验证的主体：一个稳定的目录对象 id、认证了它的那个目录，以及该目录公开的显示名与地址。对象 id 配上目录 id 才是其他工作应当绑定的身份，因为名字和地址都会变，而对象 id 不会。

它**不是**成员身份。[行事上下文](../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md)决定一个人可以以什么身份行事；身份面只说明是哪个人登录了。把外部账号绑定到成员身份是组织的行为，而能创建绑定的目录终将移除某个人——这件事由[会话归属](../../.agents/notes/proposed/architecture/2026-10-07-session-ownership.zh.md)回答。

## 主体从哪里来

来自对厂商自己的目录 API 的一次已认证调用，而不是来自客户端收到的某个令牌的声明。经 TLS 直接兑换授权码，意味着答案的可信度等于那条连接，而且决定它说什么的是厂商而不是客户端——所以自己兑换授权码的身份面不验证任何令牌签名、也不持有任何密钥材料。

而必须接受"自己并未兑换过的令牌"的那一面——例如收到别处铸出的机器人令牌的渠道——确实需要那套验证。这是令牌如何到达的性质，不是厂商的性质。

## 凭据与托管边界

厂商应用凭据属于注册它的那个组织。在共享的托管基础设施上，agent 必须读不到它，而 [`credentials-local`](../../packages/credentials/credentials-local/README.zh.md) 自己明说它提供不了这一点：它的文件由 agent 自己的工具所运行的那个操作系统用户可读。

所以在"agent 够不到的凭据存储"存在之前，厂商集成只出厂给桌面端与独立部署——那里运营方与凭据所有者是同一个人。这与[命令容器](../../.agents/notes/proposed/architecture/2026-10-08-agent-isolation-and-teams.zh.md)是同一条边界，而且它是前置条件，不是以后再补的改进。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmicrosoftentra--microsoftentra"></a>

### `ctx.microsoftEntra` — `MicrosoftEntra`

Microsoft Entra sign-in.

```ts cordis-catalog
/**
 * The person this deployment signed in.
 * @returns the stored subject, or undefined while nobody has signed in.
 */
async subject(): Promise<EntraSubject | undefined>
```

Source: [`packages/vendor/microsoft-entra/src/index.ts`](../../packages/vendor/microsoft-entra/src/index.ts)
<!-- END GENERATED cordis-surface -->
