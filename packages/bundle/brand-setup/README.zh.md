---
description: "brand-setup profile：一个运营方用来为部署设置品牌的环回页面，只能通过命令打印的令牌进入；面向私有部署的运营方与品牌工具链的维护者。"
kind: "package-bundle"
---

# `@lyness/lyn-brand-setup`

[English](README.md) | 中文

## 概述

本 bundle 即 `lyn --profile brand-setup`，私有部署的运营方在服务器上运行它，用页面而不是命令行参数来设置品牌。它开一个环回 HTTP 服务、打印一个携带令牌的地址，并提供填写产品名称、调色板与图标的表单；应用时执行与 [`brand-studio`](../brand-studio/README.zh.md) 相同的生成流程，写入相同的 `brand-deployment` 行。比起 studio，当运营方更希望看到当前品牌、只改其中一部分而不是把每个参数重述一遍时，选它。它不挂载任何到达模型的东西。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未尽事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```sh
lyn --profile brand-setup
```

命令打印唯一能进入页面的地址：

```text
brand-setup: open this address on this machine; it is the only way in and it ends with this process.
  http://127.0.0.1:52341/?token=M5t0_…
  writes   /home/acme/.lyn/profiles/web/cordis.patch.yml
  assets   /home/acme/.lyn/brand
```

在服务器上打开它，或把端口通过 SSH 转发到本地再打开。页面以该行已有的品牌为初始值，因此改一个颜色就只需要改一个字段。应用会写出三个 SVG 和该行；会在补丁层变化时重载的 `lyn web` 立即显示新品牌，其他 profile 在下次启动时应用。进程在你停止它之前持续服务，令牌随它一同消失。

### 为什么用令牌而不是登录

页面写的是 profile 的补丁层，它的优先级高于任何用户设置（[顺序](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.zh.md)），因此"能进入"必须等同于"人在服务器所在之处"。两件事共同表达这一点：服务绑定环回接口，且每条路由都要求本进程打印到自己终端、仅保存在内存里的令牌。没有存储的凭据，没有第二个地址，事后也没有东西需要吊销——停掉命令就关上了唯一的门。页面读到令牌后立即把它从地址栏移除，因此它既不会进入 `Referer`，也不会留在你粘贴的那个地址之后的历史记录里。

### 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `target` | `web` | 补丁层接收品牌行的 profile。 |
| `assetDirectory` | `$LYNESS_HOME/brand` | 接收生成 SVG 的绝对目录。 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内幕——点击展开</summary>

bundle 的补丁先插入 [`lyn-host-webserver`](../../host/webserver/README.zh.md)，绑定 `127.0.0.1`、端口取 `0`，于是由操作系统挑一个空闲端口、且除本机外无人能连接，再在其上插入本插件。三条精确路由：`/` 提供文档，`/state` 回答该行当前的名称与调色板令牌，`/apply` 接收一次提交。令牌比较是常数时间的，并先比长度。`/apply` 把请求体限制在页面能产生的最大图标加字段之内，在 [`src/brand-request.ts`](src/brand-request.ts) 中解析提交，把上传的 PNG 写入一个私有临时目录后交给 `runStudio`——品牌规则全部由它拥有；无论运行成功与否，临时目录都会被清掉。运营方能据以行动的拒绝以 400 连同其消息返回，其余情况返回 500 并进日志，因为那段文字是这个服务自己的事，不是运营方的事。

[`src/page.ts`](src/page.ts) 里的文档是一个自包含字符串：没有打包器、没有客户端插件名册、除自身外没有别的来源。它内联携带本产品发布的两种语言并由浏览器选择，因为一个从终端进入的运营方工具够不到产品的 locale 服务。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当页面不是合适的入口时读这些页面。它们从它驱动的生成流程走到它写入的那一行。

- [brand-studio](../brand-studio/README.zh.md)——同一套生成流程的单条命令形式，适合脚本化设置品牌。
- [brand-deployment](../../host/brand-deployment/README.zh.md)——本页面写入的那一行，以及被服务的页面拿它做什么。
- [webserver](../../host/webserver/README.zh.md)——本 bundle 挂载的环回服务。
- [app-boot](../../boot/app-boot/README.zh.md)——`--profile` 如何解析本页面写入的补丁层。

-----

<a id="model-experience"></a>
## 模型体验

无。本 profile 不挂载模型、会话或工具行；这里没有任何东西到达模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与未尽事项

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了页面今天能设置哪些品牌内容。它们是当前的包约束，不是与 studio 的对比，也不是待办列表。

- **不支持上传字体**——字标用内置字体排版；品牌方自有的字体文件仍需 `lyn --profile brand-studio --font`，那条路径带着该选择所要求的授权确认。
- **应用前没有预览**——页面在运行后显示写出的文件，而不是运行前的图形；要看标志得打开写出的 SVG。
- **两位运营方之间没有冲突仲裁**——应用是串行的，因此两次应用不会交错成「行里是这个品牌的名字、磁盘上是那个品牌的图形」。除此之外没有任何仲裁：令牌对持有者一视同仁，页面不察觉第二个写入者，两人先后应用时留下的是后者，哪怕他们改的是不同字段。这是一个单运营方工具——独立部署本就是这个场景。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变量：** 不发布伴生包。服务除了它铸出的令牌与注册的路由之外不持有状态，两者都随 fiber 一同离开。
