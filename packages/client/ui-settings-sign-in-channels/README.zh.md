---
description: "管理员配置人们经由哪些目录登录的那个设置页。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-sign-in-channels

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-sign-in-channels` 加一个设置页：这套部署让人们经由哪些目录登录，以及增删改一个渠道的表单。表单的字段来自管理员选的那个种类，所以它不会去要一个目录根本不收的设置。应用密钥只进不出——这个页面读到的任何东西都产生不出一把密钥。

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

Web bundle 把它挂在其余设置页旁边：

```yaml
- id: ui-settings-sign-in-channels
  name: '@lyness/lyn-client-ui-settings-sign-in-channels'
```

没有别的要配。页面打开时读 `remote.signInChannels`，并渲染四者之一：渠道与表单、一句「这个部署不配置登录渠道」、一句「只有管理员能配置」，或者一次失败加一个重试。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**三个答案，只有一个值得重试。** 不挂存储的部署不会在读者等待期间长出一个来，没有那个身份的调用者也不会因为再问一次就有。只有真的读坏了，才给按钮。

**表单由种类生成。** 每个种类自己声明需要哪些设置，表单就正好渲染那些——按那个目录自己的叫法标注，按那个种类的说法标出必填。换一个种类会清空已经填的，因为 corpid 不是 app id。

**拒绝只标它点名的字段。** `sign-in-channels/incomplete` 携带那些空着的设置，表单只标这些，于是一次关于身份的拒绝不会去指一个本来就对的字段。

**删除会先问一次。** 拿掉一个渠道，等于掐掉所有用它的人的入口，并删掉它的密钥，所以走共用的风险确认，而不是一次点击。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-sign-in-channel-controller`](../../api/sign-in-channel-controller/README.zh.md) —— 这个页面调用的命名空间，以及每种拒绝的含义。
- [`lyn-sign-in-channels`](../../identity/sign-in-channels/README.zh.md) —— 它背后的记录，以及那条决定谁能改什么的规则。
- [`lyn-client-ui-sign-in`](../ui-sign-in/README.zh.md) —— 配置好的渠道出现在哪块屏上。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它渲染的是一个配置界面，它显示的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **页面对每个读者都提供** —— 打开设置的普通成员会看到它，读到一句「只有管理员能配置」，而不是压根看不到这一页。要藏起来，得让导航在页面自己的读返回之前就知道调用者的身份。
- **没有连通性测试按钮** —— 一个渠道只要它的种类接受了设置就读作服务中，这与「目录真的会应答」不是一回事；第一个试着登录的人才会发现。
- **组织是打出来的，不是选出来的** —— 表单把组织标识当文本收，因为客户端还读不到一份组织目录。

**运行时不变量：** 不发布伴生检查。页面从一次读与它自己那些调用的结果渲染而来，不存在第二份副本与部署发散。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

读放在插件里而不是组件里，是为了让每个打开的界面共享同一次在途的读；`SectionBinding` 正是让这次读可以在框架烘出 store 之前就落定的那一层。

</details>
