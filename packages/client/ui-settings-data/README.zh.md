---
description: "设置里的数据分区：一个人自己的对话，导出与删除都在他手里。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-data

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-data` 是个人平面的数据页：读它的人能打开的每一段对话一行，每行带着他拥有的两件事——下载一份副本，以及删除它。这些行就是会话目录自己的行，所以这个页面和侧边栏不可能对「存在什么」给出不同答案。删除会在那一行上问一次、不可撤销，页面还会说出它不拿走什么：上传的文件按内容存放，可能同时属于别的对话。

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

Web bundle 把它与删除服务及其命名空间一起挂上：

```yaml
- id: ui-settings-data
  name: '@lyness/lyn-client-ui-settings-data'
```

没有别的要配。页面自己挂 `sessionData` 命名空间，并在那个命名空间在位期间注册分区，所以没有删除那几行的部署根本不显示数据页，而不是显示一个按钮只会拒绝的页面。

下载属于另一个插件。挂了 `lyn-session-log-export` 的地方，每一行都提供它，拿到的 ZIP 与会话标题栏自己那个动作下载的是同一份归档；没挂的地方页面会把这件事说出来，删除照旧可用。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**这些行就是目录的行。** 它们从 `ctx.sessions.list` ——侧边栏读的那个来源——投影而来，并缓存到那份快照移动为止，这正是 `useSyncExternalStore` 的读者对派生来源的要求。自己再读一份列表，会成为这个页面唯一可能与客户端所持内容不一致的地方。

**空白行与 subagent 行不是对话。** 空白行是「新对话」手势撑着的那个未用会话。subagent 行属于派发给它的那段对话：导出在那里归档它，删除在那里移除它，所以单独提供它就是对同一件东西给出两个控件。

**确认是行上的一个状态，不是一个对话框。** 被确认的东西就是读者正在看的那段对话，所以第二次点击落在与第一次同一行上。去问另一行会丢掉第一个问题，所以一个确认永远不会被用在读者已经离开的那一行上。

**行之所以消失，是因为 Host 不再列出它。** 删除会刷新目录，而不是在本地把那行剪掉。刷新失败会留下一行指着一段已经消失的对话，下一次列表会纠正它——把删除报成被拒绝会更糟，因为它确实发生了。

**下载控件和关于它的那句话骑在同一个答案上。** 两者都跟随下载服务是否在位，所以页面既不会提供一个用不了的按钮，也不会宣称一个并不成立的缺席。

**命名空间在这里挂。** 这个包是它唯一的消费者，所以页面和它发出的调用一起到来、一起离开，而不是被接进客户端核心的 Remote 装配里。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-session-data-controller`](../../api/session-data-controller/README.zh.md) —— 这个页面调用的命名空间，以及它渲染的那些拒绝。
- [`lyn-session-deletion`](../../session/session-deletion/README.zh.md) —— 一次删除移除什么、留下什么。
- [`lyn-session-log-export`](../../session-query/session-log-export/README.zh.md) —— 每一行提供的那个下载。
- [一个个人平面](../../../.agents/notes/proposed/architecture/2026-10-28-the-personal-plane.zh.md) —— 这个页面为什么属于个人平面，以及那里还该有什么。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个包不注册工具也不注册提示词：它是存储对话之上的一个人类界面。

#### KV 缓存影响

没有。一个人在这里读、下载或删除时，没有任何请求前缀发生变化。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **一次一段对话** —— 没有全选、也没有「全部删除」，所以一长串历史要一行一行清。
- **开着的对话会被拒绝** —— 页面不为它禁用控件，因为一段对话是否开着是 Host 的答案；拒绝会点名它，读者先把它关掉。
- **没有搜索和分页** —— 页面按目录持有的内容、按目录的最近顺序列出。历史很长的部署在这里没有办法把它收窄。
- **下载离开了页面** —— 目的地和进度归浏览器所有，所以下载开始之后的失败由浏览器报告，而不是在这个页面上。

**运行时不变量：** 页面渲染会话目录自己的行，并在发出任何删除之前在那一行上要求确认。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文 —— 点击展开</summary>

如果将来真有留存策略落地，这个页面是陈述它的地方、而不是设定它的地方：这个人读的是部署决定了什么，就像能力页对别人替他选的一切所做的那样。

</details>
