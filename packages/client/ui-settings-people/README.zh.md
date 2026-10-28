---
description: "管理员维护「谁可以使用这个部署」的那个 Settings 页面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-people

[English](README.md) | 中文

## 概述

`dsh-client-ui-settings-people` 增加一个 Settings 页面：谁可以使用这个部署、各自能做什么，以及哪个目录身份以他的身份登录。管理员添加一个人、给他一个身份，并准入为他做认证的那个目录身份；写在安装自己文件里的人只展示、不提供编辑，因为下一次启动会重新读那个文件。添加一个人并不准入任何人——在有身份被绑定到他之前他登录不进来，页面会在那一行写明这一点。

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

Web bundle 把它挂在其他 Settings 页面旁边：

```yaml
- id: ui-settings-people
  name: '@deepseek-ai/dsh-client-ui-settings-people'
```

没有别的可配置项。页面打开时读取 `remote.people` 与 `remote.signInChannels`，并渲染四者之一：名册与表单；一条「这个部署不维护自己的目录」的提示；一条「调用方无权更改」的提示；或者一次失败加一个重试按钮。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**三种回答，其中只有一种值得重试。** 不挂载目录的部署不会在读者等待期间长出一个，没有相应身份的调用方也不会因为再问一次而获得它。只有「读取坏掉了」才给出那个按钮。

**写下的人只展示、不提供操作。** 那一行写明这个人由安装的配置拥有，并且不带「编辑」「移除」「撤回」：在这里被接受的修改会在下一次启动时被回退，而界面已经报告了一件不真实的事。

**身份变更之后重新读取人员。** 一条绑定属于某个人，所以变的是「他有哪些身份」；因此重新问服务端，而不是在本地改那一行。变更成功而随后的读取失败，仍然按「变更成功」汇报，因为让管理员把同一个人准入两次比留下一行过期数据更糟。

**准入表单出现在正在编辑的那个人下面。** 身份表单属于某一个人，把它放在添加表单旁边会让「即将准入给谁」变得不清楚。

**移除要先问。** 它终结这个人的全部登录方式，并撤回被准入为他的身份，因此走共用的风险确认，而不是一次点击。他的对话仍归属于他、不会被删除，确认框里写明了这一点。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-api-people-controller`](../../api/people-controller/README.zh.md) —— 这个页面调用的命名空间，以及每种拒绝的含义。
- [`dsh-managed-people`](../../identity/managed-people/README.zh.md) —— 它背后的目录，以及决定谁管得着谁的那些规则。
- [`dsh-client-ui-settings-sign-in-channels`](../ui-settings-sign-in-channels/README.zh.md) —— 绑定所指名的渠道在哪里配置。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它渲染一个配置界面，它显示的东西都不会进入模型请求。

#### KV Cache 影响

请求前缀不变，因为这里没有任何东西参与请求装配。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **这个页面对每个读者都提供** —— 成员打开 Settings 会看到它，并读到「你无权更改谁使用这个部署」的提示，而不是根本看不到这个页面。要隐藏它，需要导航在页面自己的读取返回之前就知道调用方的身份。
- **目录身份是手输的，不是搜出来的** —— issuer 与 subject 需要手工填写，因为没有任何渠道种类提供目录搜索；填错的结果是谁都进不来，而不是错的人进来。
- **组织是手输的，不是选的** —— 表单把组织 id 当文本收，因为客户端还读不到任何组织目录。
- **没有邀请流程** —— 人是由已经知道他目录身份的管理员添加的；没有「某人先登录、再申请准入」的流程。

**Runtime invariant:** 不发布任何 companion。这个页面只从一次读取和它自己调用的结果渲染；不存在第二份可能与部署分歧的副本。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

读取放在插件里而不是组件里，于是一次在途读取被所有打开的界面共享；`SectionBinding` 正是让这次读取可以在框架烘好 store 之前就结算的东西。两个命名空间都被注入，因为一条绑定要指名一个已配置的渠道，而选择器需要那份列表。

</details>
