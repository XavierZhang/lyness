---
description: "管理端的邀请码页：签一张码、读出仍然有效的那些、撤回其中一张。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-admin-invitations

[English](README.md) | 中文

## 概述

`dsh-client-ui-admin-invitations` 是管理员签发邀请码的那一页。它注册进 `admin.section`、读 `remote.invitations`，并提供一张表单：这张码叫什么、它授出什么标准、那个标准在哪个组织、允许兑换几次、保持多久有效。新签出的码只展示这一次，并带上用本部署自己的 origin 拼出的兑换链接——因为签发它的那次应答是它唯一存在过的地方。撤回要走一次确认，并且那一行会留下来，只是不再有效。

## 目录

- [使用这个包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未完成事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用这个包

账号模块把它与它所读的那个命名空间挂在一起：

```yaml
- id: invitations-controller
  name: '@deepseek-ai/dsh-api-invitations-controller'
- id: ui-admin-invitations
  name: '@deepseek-ai/dsh-client-ui-admin-invitations'
  config:
    joinPath: /join
```

`joinPath` 是被复制的那条链接把人送到哪里，它必须与兑换页实际被服务的路径一致：链接是按 `<origin><joinPath>?invite=<code>` 拼出来的。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**只要管理员还在这一页，码就只住在一个地方。** 它随 `issue` 的应答到达，作为那次更改的结果被发布出来，并在进入列表的那一行里被摘掉。下一次读完全不携带码，因为部署只留哈希——于是这一页永远不会展示一张「它本来就不可能刚刚拿到」的码。

**链接是用这一页自己的 origin 拼的。** 管理员发出去的，是他此刻正在看的那个地址；从配置里拼它，会让一个部署发出指向它并不服务的主机的链接。

**读不出来有三种原因，只有一种值得给按钮。** 不签发邀请码的部署、以及没有那个标准的调用方，都会把原因说出来、不给重试；只有真的读坏了才给。

**拒绝会点名自己的字段。** `invitations/incomplete` 标出「组织」那一栏；其余每种拒绝都以文字汇报，因为没有哪一栏是管理员可以去改的。

**撤回要确认，而且不是删除。** 确认里写明：这张码对已经拿到它的人也会立刻失效；之后那一行是「已失效」而不是消失——这正是部署自己答出的样子。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-api-invitations-controller`](../../api/invitations-controller/README.zh.md) —— 这一页读的那个命名空间，以及它能汇报的每种拒绝。
- [`dsh-invitations`](../../identity/invitations/README.zh.md) —— 一次提交被拿去对照的那些边界。
- [`dsh-client-ui-admin-console`](../ui-admin-console/README.zh.md) —— 这一页渲染在里面的那个页面。
- [`dsh-module-accounts`](../../bundle/module-accounts/README.zh.md) —— 把这一整套选进来的那个组合。

-----

<a id="model-experience"></a>
## 模型体验

无：这个包不注册任何工具或提示词，它是一个 Remote 命名空间之上的浏览器界面，它渲染的东西没有一样进入模型请求。

#### KV 缓存影响

不改变任何请求前缀，因为这里没有任何东西参与请求组装。

## 已知限制与未完成事项

<a id="known-limitations-and-deferred-work"></a>

- **离开这一页，码就没了**：它只被放在这一页的 store 里，所以签完之后刷新，看到的是那一行、没有码。
- **没有任何东西负责把邀请发出去**：这一页答出一张码和一条链接，送达是管理员自己的事。
- **有效期只有三个选项**：一天、一周、一个月，而且部署自己的上界仍可能拒绝；不提供任意填写。
- **没有分页**：这一页把这个标准管理着的全部渲染出来。
- **「谁兑换了哪张码」不在这里**：使用次数会动，而一次兑换要去管理历史里读。

**运行期不变量：** 除了签发它的那次应答，没有任何码到得了这一页；也没有任何码被写到「下一次读可能展示出来」的地方。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

签发成功后压进列表的那一行，是把应答视图的 `code` 摘掉之后的样子，于是列表自己的形状与后续一次读答出的一致，没有哪个组件需要去判断「我手里这张码是不是过时的」。

</details>
