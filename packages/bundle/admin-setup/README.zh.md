---
description: "admin-setup profile：一条命令，把一套部署的第一位平台管理员、他登录用的提供方，以及放他进来的那条绑定写进某个 profile；给安装这套部署的人用。"
kind: "package-bundle"
---

# `@lyness/lyn-admin-setup`

[English](README.md) | 中文

## 概述

这个 bundle 就是 `lyn --profile admin-setup`——一套新部署在第一次启动之前运行一次的命令。它往目标 profile 的组合层里写三样东西：那位唯一的平台管理员的名册条目、他登录所经的 OpenID 提供方，以及放他进来的那一条准入绑定。那个层每次启动都会被重新读，所以它点名的东西在管理端既改不了也删不掉——这正是这位管理员无法被锁在门外的原因，也是别人被锁在门外时的那条回去的路。它不挂任何够得着模型的东西。

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

```sh
lyn --profile admin-setup --target acme --person ada --name Ada \
  --issuer https://id.acme.example --client-id 298412... --subject 298430...
```

它会报出写了什么，以及剩下的两步：

```text
admin-setup: "Ada" administers the "acme" deployment
  person    ada
  provider  https://id.acme.example (channel oidc, client 298412...)
  subject   298430...
  patch     /home/acme/.lyn/profiles/acme/cordis.patch.yml

Two things left, in this order:
  1. give the deployment the client secret: OIDC_CLIENT_SECRET=… lyn --profile acme
  2. register the provider's redirect URI as <your public origin>/auth/callback/oidc
```

同样的值跑第二遍什么都不改。为另一个人跑它会被拒绝，因为一套部署只有一位写定的管理员：`--replace` 会把新的那位写在旧的位置上，而此后的每一位管理员都从管理端添加。

### 每个值从哪里来

| 参数 | 去哪里读 |
|---|---|
| `--person` | 你自己定，而且是永久的：会话、发放与绑定都写在它上面 |
| `--issuer` | 提供方自己的 issuer URL；discovery 从它读 |
| `--client-id` | 你为这套部署在提供方那里注册的那个应用 |
| `--subject` | 提供方在它自己的后台里给那个人留的那个 id——**不是**他的邮箱：邮箱可以被重新分配，而这条绑定不能跟着跑 |
| `--secret-name` | 客户端密钥被读取时所用的凭据引用名；默认是 `OIDC_CLIENT_SECRET` |

-----

<a id="understand-the-implementation"></a>
## 理解实现

**「人站在文件所在的地方」就是授权。** 没有 token、没有页面、没有登录：这条命令写的是 profile 的组合层，而那个层压过运行期的一切界面，所以能运行它的唯一方式就是站在这套部署的文件旁边。

**提供方是 insert，名册与准入是 patch。** 账号模块组合出一个名册行、一个准入行，以及**完全没有**提供方，所以提供方以 `insert` 条目的形式到来，而另外两个是按 id 的覆盖。当被覆盖的那一行加载的是另一个包时，带 `name` 的覆盖会被跳过，所以这两个 patch 都不写 `name`——准入那一行已经换过一次手了，从受管规则换成了认邀请码的规则。

**一个人在一个渠道上只有一条绑定。** 用另一个 subject 再跑一次是**替换**那条绑定，而不是再加一条：一个把某人的 id 重发过的提供方，不该留着旧的那一条继续放人进来。

**它只写自己拥有的那三样，其余一概不碰。** 注释、其他行、其他人、其他绑定与 `!!js` 值都原样留着，因为这个层是以 YAML 文档的方式被编辑的，而不是重新生成的。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [独立部署的安装与管理](../../../docs/user/guide/standalone-administration.zh.md) —— 整套安装流程，这条命令是其中一步。
- [`lyn-oidc`](../../identity/oidc/README.zh.md) —— 这条命令写出的那个提供方行，以及它接受的每一项设置。
- [`lyn-managed-people`](../../identity/managed-people/README.zh.md) —— 为什么写定的条目在管理端改不了。
- [`lyn-brand-studio`](../brand-studio/README.zh.md) —— 另一条编辑 profile 组合层的运维命令。

-----

<a id="model-experience"></a>
## 模型体验

无：这个 bundle 不注册任何工具或提示词，它就是一条写完文件就退出的运维命令，它做的事没有一样进入模型请求。

#### KV 缓存影响

不改变任何请求前缀，因为这里没有任何东西参与请求组装。

## 已知限制与未完成事项

<a id="known-limitations-and-deferred-work"></a>

- **只支持 OpenID 提供方**：三种企业目录仍然按独立部署指南里的样子手写；这条命令认的是三种形态都在用的那一种。
- **它不去碰提供方**：issuer、client 与 subject 都按给定值写入，所以打错字的结果是「第一次登录时谁都进不来」，而不是在这里就被拒绝。
- **不收客户端密钥**：它写的是凭据引用名，真正的值在启动时从环境来；把它写进这个层，等于把一把活的密钥放进产品每次启动都要读的文件里。
- **只有一位管理员**：这正是它的用意，也是第二次运行被拒绝而不是被合并的原因。

**运行期不变量：** 这条命令只写一个 profile 的组合层，别的什么都不写：没有凭据值、没有状态、没有网络调用。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

`upsertFirstAdministrator` 是「文本进、文本出」的纯函数，所以它施加的每一条规则都是对着层文本的夹具钉住的，而不是对着文件系统；`runSetup` 在它之上只多了一次读取和一次原子替换。

</details>
