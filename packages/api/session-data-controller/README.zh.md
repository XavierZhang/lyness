---
description: "一个人自己的对话：他能要求的那次删除，以边界为他能看见的范围。"
kind: "package-reference"
---

# @lyness/lyn-api-session-data-controller

[English](README.md) | 中文

## 概述

`lyn-api-session-data-controller` 拥有 `sessionData` Remote 命名空间：一个方法，删除调用者自己的一段对话，并回答有哪些存储会话消失了。它能动哪段对话，从不是调用方能放宽的参数——归属规则从对话自己的日志里回答它——所以别人的 id 得到的回答，与一个从未存在的 id 完全相同。这个命名空间不读列表：`session.list` 已经回答了调用者能看见哪些对话，第二份列表会成为页面与它所操作的东西唯一可能互相矛盾的地方。

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

与它调用的服务一起挂：

```yaml
- id: session-deletion
  name: '@lyness/lyn-session-deletion'
- id: session-data-controller
  name: '@lyness/lyn-api-session-data-controller'
```

`delete(sessionId)` 移除那段对话以及它下面每一个 subagent 会话，然后回答它们的 id。两行都不选的部署不提供这个命名空间，挂载它的那个设置页也就不会出现。

### 拒绝

| 代码 | 含义 |
|---|---|
| `session-data/not-found` | 这个调用者没有这样一段对话：它不存在，或者它属于别人。 |
| `session-data/open` | 这段对话还开着。什么都没被删除；关掉它再问一次就会成功。 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

**「不存在」和「属于别人」用同一个代码。** 为后者单独给一条拒绝，就等于告诉一个人另一个人的对话存在——这与导出路由把看不见的会话答成不存在，是同一个理由。

**用权威的那次读取，不用便宜的那次。** 可见性由对话的一次观测决定——活会话从自己的投影回答，冷会话从自己的日志回答——而不是由列表缓存决定，因为这次调用作用在一段被指名的对话上，而不是在筛一页对话。

**没有归属规则的部署只有一位操作者。** 他可以删掉他要删的东西；没有别人可供这个答案去谈论。

**它声明的身份要求是 `member`。** 它接纳部署认识的任何人，不要求组织身份：一段对话属于开它的那个人，而不属于某个组织的成员。

**在两步之间变成活会话的对话，与另一个进程正在写的对话，得到同一个答案。** 两者都回成 `session-data/open`，因为无论哪种情况，让删除成功的办法都是关掉它。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-session-deletion`](../../session/session-deletion/README.zh.md) —— 这次删除移除什么、按什么顺序、留下什么。
- [`lyn-session-ownership`](../../identity/session-ownership/README.zh.md) —— 决定这段对话属于谁的那条规则。
- [`lyn-client-ui-settings-data`](../../client/ui-settings-data/README.zh.md) —— 调用这个方法的那个页面。
- [`lyn-api-remote-authority`](../remote-authority/README.zh.md) —— 执行这个命名空间所声明身份要求的地方。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个包不注册工具也不注册提示词：它服务的是一个人对自己存储的对话采取行动。

#### KV 缓存影响

调用时没有。被删掉的对话不会有下一次请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有批量删除** —— 一次调用一段对话，所以要清掉一长串历史的人得逐行点。提供「全部删除」的页面需要一个还没人定过的界限。
- **没有导出方法** —— ZIP 与 Markdown 导出是 `lyn-session-log-export` 拥有的、经过认证的 Host 路由；这个命名空间不再加第二条把对话读出来的路。
- **开着的对话不能删** —— 拒绝会点名它，读者先把它关掉。为了删除而去结束某人的对话，是这次调用不做的第二个决定。

**运行时不变量：** 每次调用都在移除任何东西之前，从对话自己的日志决定可见性。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文 —— 点击展开</summary>

`delete` 回答被移除的 id 而不是一个布尔值，这样页面能说出有多少份存储会话消失了：一段派发过工作的对话不止一份日志，删掉它的人有权知道这一点。

</details>
