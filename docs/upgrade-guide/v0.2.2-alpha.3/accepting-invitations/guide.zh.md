---
kind: upgrade-guide
description: "`invitations` 命名空间多出 `accept`，成员就能调用；加入页不再把已经登录的人挡回去。"
---

# 已经在这里的人接受一张邀请

[English](guide.md) | 中文

## 变更

`ctx.invitations` 多出 `accept(code, person)`，`invitations` 这个 Remote 命名空间多出 `accept(code)`。在此之前，一张码只能到达名册从没见过的主体：已经被绑定的人登录时就是他自己，手里的码不改变什么。**登录途中它仍然不改变什么**——一条被转发的链接不该往「持有者并没有要求改动的账户」上加授权——但那个人现在可以自己出示它，在已持有的身份之外再获得它携带的那一个。

跟着动的有三处：

- `invitations/accept` 是这个命名空间里第一个 `member` 够得着的方法，其余每一个仍然要求 `tenant-administrator`。它只收那张码：加到哪个账户上，来自这次调用自己的会话。
- 它的应答是 `AcceptanceView`——`accepted`，以及授出的 `role` 与 `organization`。**每一种拒绝都读作 `accepted: false`。**
- `@lyness/lyn-client-ui-join` 现在注入 `remote` 与 `remote.invitations`，而它的 `blockedBy` 不再答 `'signedIn'`。不带 Client remote 装配就挂这一页的组合，会让它停泊。

## 迁移

1. 经 `@lyness/lyn-web-app` 挂 `@lyness/lyn-client-ui-join` 的部署不用改：Client 装配把每个命名空间都挂上了。手工组合这一页的，图里必须有 `@lyness/lyn-api-remotes/client`，否则这一页永远不出现。
2. 从 `@lyness/lyn-client-ui-join/client` 读 `blockedBy` 的代码去掉 `'signedIn'` 这一支；已登录的那次访问现在渲染的是接受。
3. `join` 这个 locale 命名空间里的 `signedInTitle` 与 `signedInHint` 两个键没有了。覆盖过它们的部署删掉那两条，可改为覆盖 `acceptTitle`、`acceptHint`、`acceptSubmit`、`acceptWorking`、`acceptNote`、`acceptedTitle`、`acceptedHint`、`nothingTitle`、`nothingHint`、`failedHint` 与 `retry`。
4. 持久化的东西一概不变：邀请记录、它的哈希与使用次数都和原来一样。

验证方式：在已登录状态下打开一条邀请链接——这一页给出一个按钮，按下之后，要么答出你现在持有的那个身份，要么答出这张码什么也没给你。
