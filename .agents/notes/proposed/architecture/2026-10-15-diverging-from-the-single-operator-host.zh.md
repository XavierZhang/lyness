# Agent Note: 离开单操作者 Host，以及这件事带来的义务

Status: proposed

[English](2026-10-15-diverging-from-the-single-operator-host.md) | 中文

## Problem

上游的 Web Host 只认证一个操作者，并把一切权限给他。两份上游决策把这件事写得一字不差：[浏览器启动令牌认证](../../implemented/architecture/2026-08-24-browser-token-authentication.zh.md) 确立了「the Web Host runs tool-capable Sessions with the current operating-system user's authority」、「possession of the browser cookie authorizes the complete tool-capable Host API」以及「endpoint ownership and method names do not alter authority」；它不提供登出，设置 `SameSite=Strict`，刻意不带 `Secure`——「because the shipped server uses loopback HTTP」——并且声明「authentication does not imply supported network deployment, TLS, forwarding-header interpretation, or proxy configuration」。[承载层的信任围栏](../../implemented/architecture/2026-07-28-api-browser-trust-boundary.zh.md) 补充说随包 CLI 拒绝 `--host 0.0.0.0`，且该围栏「is a confused-deputy defense rather than identity」。上游还考虑并否决过「加登出、TLS 代理与转发头配置」，理由是回环 Web 应用里没有任何东西需要它们。

那个模型是自洽的，而且对一个本机开发者 harness 来说，比取代它的东西更强：权限边界就是操作系统账号，而且不存在「按方法搞错」的空间。

本产品是一个托管服务，一个部署上有许多人。所以它恰恰需要上游否决掉的那些东西——人、角色、会过期且可吊销的会话、按人计量、一条签入渠道、以及一个浏览器经网络到达的 origin——而其中几项这里已经落地：`identity/people`、`identity/auth-session`、`identity/sign-in`、`identity/request-principal`、`credits/credits`、`tenant/*`。这些上游都没有，而且上游没有可供扩展的多用户概念。

偏离已经是事实，而它不完整的方式值得明说。已落地的按人规则强制在 `llm/stream` 这个 waterfall 上，所以它们覆盖的是模型调用。可执行工具的那一面没有被触碰：`api/settings-controller` 与 `api/session-controller` 里没有任何授权检查，所以任何已认证的 principal 仍然可以写设置、驱动一个会话——而一个会话会做什么，上游自己记着：「`session.prompt` drives an agent that runs bash」。凭据是一份 owner 作用域的记录集，会话持久化取一个 `root` 目录与一份查询索引。[agent 隔离](2026-10-08-agent-isolation-and-teams.zh.md) 已经把这些点名为三条各自缺失的边界，并提议「一个组织一个进程」；它尚未建成。

所以摆在面前的问题不是「要不要偏离」。而是：在偏离只做了一半的时候，这个部署可以做什么。

## Proposal

把这次偏离记为一个刻意且有界的决定，并把托管产品的第一阶段绑定到它今天安全的那一半上。

**第一阶段的托管服务器不运行任何用户代码。** 一个 SaaS 部署挂控制面——身份、签入、积分、模型策略、会话、设置、公告——不挂任何执行提供者、也不挂任何执行工具。凡是触及文件、shell、终端、语言服务器、浏览器或屏幕的 agent 工作，都跑在那个人自己的机器上：能力缝的定义与它们的工具留在服务器，而提供者那一半跑在人的身边，由服务器以 `fs-ssh` 与 `subprocess-ssh` 到达另一台机器的同一种方式到达。云端执行等「一个组织一个进程」。由此推出的逐包归属是另一份记录，等那部分工作开始时再写。

这正是与上游不冲突的那一半。上游让 agent 以「人正坐在其前的那台机器」的权限运行；一个桌面执行器做的就是这件事。上游从未设想过的——一个共享运行时执行好几家客户的 agent——才是我们延后的那一半。

### 我们在哪四点上离开上游，以及为什么

| 上游 | 这里 | 为什么产品要求如此 |
|---|---|---|
| 一个 cookie 授权完整的 API；方法名不改变权限 | 一次请求代表一个人，而一个操作针对那个人的角色自我授权 | 托管部署有成员与管理员；「那个操作者」谁都不指 |
| 没有登出 | 会话带有过期，并且可以被吊销 | 共用的机器、丢掉的笔记本、离职的员工，都需要一个会话能结束 |
| `SameSite=Strict`、不带 `Secure`、回环 HTTP | `SameSite=Lax`，`Secure` 是必填的部署字段 | 目录以顶层导航把浏览器送回来，而 `Strict` 会拒绝它；一个网络 origin 不能让 cookie 明文上路 |
| 认证并不意味着支持网络部署 | `publicOrigin` 是必填字段，信任围栏被配置 | 浏览器经网络到达这个部署，这是定义本身 |

信任围栏本身没有改动。它仍然是防混淆代理的防御，而签入叠在它之后——正是上游叠放认证的那个位置。

### 这次偏离换不来什么

它不会让一个共享运行时变得多租户安全。计量一个人的模型调用，与那个人能否读到部署的凭据、或另一家客户的会话，是两件无关的事。任何人把积分、角色或模型策略当成隔离边界来读，都是读错了：那三者约束的是模型请求，别的什么都不约束。

## Alternatives considered

**留在上游的单操作者模型上。** 被否决的理由是它没有可供扩展的多用户概念，而不是它弱。对一个操作者在自己机器上运行的 harness 来说，「一个 cookie 等于全部权限」是正确答案；但它表达不了「这个成员可以选模型、不能改模型列表」，而那是已经写定的产品要求。

**把按人的检查放在界面里。** 按仓库自己的规则否决：界面或 RPC 处理器里的授权检查会被下一个调用方绕开——一行预设、一个 profile 补丁、一个维护任务、一次直接 RPC。这正是已落地的检查坐在 `llm/stream` 与 `ModelPolicy.save` 上的原因，也是「扩展它们意味着扩展操作、而不是扩展界面」的原因。

**现在就上托管云端执行，用查询条件隔离客户。** 被否决。[agent 隔离](2026-10-08-agent-isolation-and-teams.zh.md) 已经记下了为什么：一个被约束的命令仍然跑在 host 上、以 host 的用户、带 host 的网络。一个每次都必须写对的条件，不是客户之间的边界。

**先把按 principal 的权限铺满整个工具面，然后再上线。** 第一阶段否决它，但不是因为它不对。它是更大的改动——每个控制器、凭据存储的作用域、会话目录树都要动——而第一阶段不需要它，因为一台什么都不执行的服务器没有工具面可供划分。云端执行一落地，它立刻变成必需。

**保留上游的 cookie 属性。** 按机制否决：`SameSite=Strict` 会在目录的返回导航上扣下 cookie，于是重定向签入永远无法完成；而在一个网络 origin 上省掉 `Secure`，等于把一个持有型凭据明文放到线上。

## Acceptance criteria

- 随包的 SaaS profile 不挂 `fs`、`shell`、`subprocess`、`sandbox`、`terminal`、`lsp` 任何提供者，也不挂 `tool-fs`、`tool-fs-search`、`tool-str-replace-editor`、`tool-bash`、`tool-pwsh`、`tool-terminal`、`tool-lsp` 任何一个。一个门禁读取随包 profile，遇到其中任何一个即失败，于是第一阶段这条边界不会被组合配置无意间绕掉。服务端持久化不受影响：`session-persistence-jsonl`、`attachment-local`、`spill-local` 与 `storage-json` 直接到达磁盘，而不经过 `ctx.fs`。
- 发给第一阶段 SaaS 部署的一次提示无法执行命令，并且有一个测试通过执行器而不是通过界面证明这次拒绝。
- 上述四个偏离点各由一个测试钉住，一旦某次合并让它悄悄回到上游的行为，该测试即失败。

## Risks

**第一阶段没有云端执行。** 「关掉笔记本任务继续跑」要等到一个组织拿到一个进程，而 `jobs-local` 的作业随进程结束。这是一个被明知地保留下来的产品能力，不是遗漏。

**上游可能在这四点下面移动。** 我们现在拥有权限、会话寿命、cookie 属性与网络部署这四件事，而上游把它们当成已经定了的一层。从此以后，上游对 Connection 认证的改动都是一次需要手工评审的冲突，而上面那些测试就是让一次无声回退变得可见的东西。

**一个组合配置仍然可以造出不安全的形状。** 运行时里没有任何东西阻止实施方在隔离存在之前就把执行挂到共享服务器上；上面那个门禁只覆盖随包 profile。一个这么做的自定义组合不在本决定的支持范围内。

**没有被触碰的工具面是一笔有期限的义务。** `settings-controller` 与 `session-controller` 没有授权检查，只在服务器什么都不执行时才可以接受。服务端执行上线那一天，它就变成一个缺陷，应当被当作待还的工作来读，而不是当作一个已被接受的状态。
