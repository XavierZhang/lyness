---
description: "管理员在运行时配置登录渠道所经过的那层界面。"
kind: "package-reference"
---

# @lyness/lyn-api-sign-in-channel-controller

[English](README.md) | 中文

## 概述

`lyn-api-sign-in-channel-controller` 拥有 `signInChannels` 这个 Remote 命名空间：这套部署可以配置哪些种类的目录、已经配置了哪些渠道，以及新建、替换、删除一个渠道的调用。谁可以改什么，不由它决定——那条规则在 `lyn-sign-in-channels` 手里，本命名空间只把这次调用所处的身份交给它。应用密钥只向内穿过；任何答案都带不出一个，因为存下来的是凭据存储保管它所用的那个引用名。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

账户模块把它挂在它所代言的那个存储旁边：

```yaml
- id: sign-in-channel-controller
  name: '@lyness/lyn-api-sign-in-channel-controller'
```

配置界面先问可以配置什么，再提交其中一种：

```ts
import type {
  ChannelInput, ChannelKindView, ConfiguredChannelView,
} from '@lyness/lyn-api-sign-in-channel-controller/types'

/** The two calls one configuration form makes. */
interface ChannelsRemote {
  /** The kinds this deployment can be configured with. */
  kinds: () => Promise<readonly ChannelKindView[]>
  /** Create one channel, or replace one that exists. */
  save: (input: ChannelInput) => Promise<ConfiguredChannelView>
}

/**
 * Configure one tenant's own directory.
 * @param remote - the `signInChannels` namespace, as the client reaches it.
 * @param input - the kind, the name, the settings, and the application secret.
 * @returns the channel as the deployment now reads it.
 */
export async function configure(
  remote: ChannelsRemote,
  input: ChannelInput,
): Promise<ConfiguredChannelView> {
  const kinds = await remote.kinds()
  if (!kinds.some(kind => kind.id === input.kind)) throw new Error('no such kind')
  return remote.save(input)
}
```

答案里的 `mounted: true` 表示这个渠道正在服务。一条读作 `mounted: false` 的记录，是它的种类不在这套组合里，或者那个种类拒绝了它的设置：记录连同配置一起留着，好让管理员去改正，而不是重打一遍。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**授权规则不在这里。** `administers(standing, organization)` 与记录待在一起，于是直接调用者、将来的某个界面、以及本命名空间，碰到的是同一条规则。本命名空间加上去的是身份：它从请求主体与目录解析出调用者的成员身份，并拒绝一次立不起身份的调用，而不是以无人的名义去配置。

**拒绝携带原因，而不是一句话。** 服务抛出带四种原因之一的 `ChannelRefusedError`，每一种映射到自己的线上错误码——表单据 `sign-in-channels/incomplete` 标出空着的字段，据 `sign-in-channels/unknown-kind` 说出缺的是哪个种类，而身份问题既不是前者也不是后者。去匹配那句话，措辞一改就坏。

**不是拒绝的东西，就按它本来的样子汇报。** 凭据存储没能保管住密钥，不是对这次提交的裁决：重发一遍不会有任何变化，把它装扮成一次拒绝，只会让管理员去改一个本来就对的字段。

**这个命名空间要求 `tenant-administrator`。** 平台管理员满足它，这就是一个身份如何同时覆盖部署自己的渠道与某个租户的渠道。把两者分开的是每条记录上的组织，而那是逐条记录检查的，不是逐次调用。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-sign-in-channels`](../../identity/sign-in-channels/README.zh.md) —— 记录、挂载，以及本命名空间向其交出身份的那条规则。
- [`lyn-sign-in`](../../identity/sign-in/README.zh.md) —— 配置好的渠道落入的那个注册表，以及构建它的那些种类。
- [`lyn-api-remote-authority`](../remote-authority/README.zh.md) —— `tenant-administrator` 在线上意味着什么。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它回答的是一个配置界面，它汇报的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **租户自己的渠道还不会出现在登录屏上** —— `identity/viewer` 向注册表要的是这套部署自己的渠道，因为还没登录的浏览器没有点名任何组织。要提供某个租户自己的渠道，得先解析出这个请求属于哪个租户。
- **不对配置做连通性检验** —— 只要某个种类能用提交的内容构建出渠道，提交就被接受；一个写法没错却不属于任何人的 `corpId`，要等第一个试着登录的人来发现。
- **一个渠道一把密钥，轮换靠替换** —— 没有第二个槽位在旧密钥仍被接受时放进新密钥，所以一次轮换总有一刻是两者之一在生效。

**运行时不变量：** 不发布伴生检查。每个答案都在被问到的那一刻从存储投影而来，不存在第二份副本与它发散。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`configured()` 用 `ctx.get` 读存储，缺席时答 `gateway/internal`，因为这个命名空间没有它也挂得起来；账户模块两行都编排，于是只有一种组合能走到那条路径——取了一行却丢下另一行。

</details>
