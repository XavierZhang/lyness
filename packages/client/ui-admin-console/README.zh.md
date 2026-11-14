---
description: "管理端：独立成页、自带外壳，所有管理页都在它里面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-admin-console

[English](README.md) | 中文

## 概述

`dsh-client-ui-admin-console` 就是管理端：它是一个独立的页面，由宿主在某个路径上以应用文档作答，里面装着管理员维护的每一页。它只在那个页面上占住内建的 `root` 席位，别处什么都不注册，因此使用产品的人根本不会加载管理端的外壳，而管理员打开的是一个 URL，而不是工作台里的一块面板。那些页面属于它们自己的包、注册到 `admin.section`；这个包负责导航、页头、它自己的登录页，以及当一个部署没有组合任何管理页时它该说什么。

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

两行：宿主用文档作答管理端那个路径，管理端占住那个页面。

```yaml
- id: frontend-static
  name: '@deepseek-ai/dsh-host-frontend-static'
  config:
    documentPaths:
      - /admin
- id: ui-admin-console
  name: '@deepseek-ai/dsh-client-ui-admin-console'
  config:
    path: /admin
```

两处路径是同一个决定说了两遍：宿主决定哪些路径给出页面，`path` 决定其中哪一个是管理端。两边不一致，管理端就不可达——要么那个页面 404，要么那份文档渲染出工作台。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它占的是整页，不是一块面板。** `root` 是 single 槽：第二个条目会遮住原来的 frame，而不是并排。在管理端那个路径上这正是意图——管理端彻底取代工作台 frame；在其他任何路径上这个插件什么都不注册，工作台毫发无损。

**路径来自文档本身。** 只读一次 `location.pathname`，因为这份文档是宿主在它选的路径上给出的；问浏览器的位置就是读宿主的回答，也正是这一点让管理端能被直接输入 URL 打开。

**有哪些页，是部署的回答。** 导航就是 `admin.section` 这本账，每一页的名字由它自己的注册本地化。管理端把已知的 id 归进三个分组，把从没听说过的放进末尾那一组——这个外壳不认识的模块，仍然是管理员必须能够到达的页面。

**对普通成员是如实相告，而不是摆出来。** viewer 服务回答这位访问者是否管理着什么；一个摸到管理端 URL 的普通成员会看到「这一页是给管理员的」，而不是一排每次调用都会被拒的导航。拒绝本身仍在各自的调用处：这里决定的是提供什么，永远不决定允许什么。

**持有两个身份的人是被问的，不是被猜的。** 登录会把「唯一的那个身份」置为生效；持有多个的人一开始一个都不持，因为「以哪个组织行事」是他自己的决定。管理端把这个问题放在一页上单独问——它后面的每一页，对一个不持身份的调用都只会拒绝——而一旦有一个生效，左栏就把其余的摆出来，于是换身份是点一下，不是退出再登。

**它有自己的登录页。** 有账号体系、而又无人登录时，管理端给出的就是这一页，后面什么都不渲染；页上每个「浏览器能发起的渠道」各一个链接——自驱动渠道在持有浏览器的那个进程里完成，页面发起不了，所以不提供。工作台那块覆盖全页的浮层不复用：`shell.overlay` 由被本管理端遮住的那个 frame 声明，声明第二次会让那个 frame 激活失败。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-host-frontend-static`](../../host/frontend-static/README.zh.md) —— 用文档作答管理端那个路径。
- [`dsh-client-ui-settings`](../ui-settings/README.zh.md) —— `admin.section` 的类型与一页收到的 owner 份额在那里声明。
- [`dsh-client-ui-viewer`](../ui-viewer/README.zh.md) —— 回答「谁在看」的那一次读取。
- [`dsh-client-ui-layout`](../ui-layout/README.zh.md) —— 管理端在自己页面上遮住的那个工作台 frame。

-----

<a id="model-experience"></a>
## 模型体验

无：这个包不注册任何工具或提示词，它是别的包所持有的 Remote 命名空间之上的一层浏览器界面。

#### KV 缓存影响

不改变任何请求前缀，因为这里没有任何东西参与请求组装。

## 已知限制与未完成事项

<a id="known-limitations-and-deferred-work"></a>

- **一份插件图，两个页面**：浏览器在两个页面上加载同一套客户端插件，所以管理端的代码也会到达从不打开它的人手里。按页面裁剪 boot 图是下一步；鉴权在服务端，不受影响。
- **页面之间没有深链**：管理端把选中的页记在本浏览器里，而不是 URL 里，所以管理员没法把某一页的链接发给同事。
- **分组是这个外壳定的**：页面 id 不在本包清单里的模块会落在末尾那一组，而不是它作者想放的位置。
- **手机上没有管理导航**：导航列在窄屏上堆到内容上方，能读，但不是为小屏设计的导航方式。
- **管理端没有 toast**：通过 `shell.overlay` 汇报的页面在这里无处汇报，因为那个席位属于工作台 frame。真需要时，正确的做法是给管理端一个自己的浮层席位。

**运行期不变量：** 除非这份文档是在它配置的那个路径上给出的，管理端什么都不注册。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

viewer 服务用 `ctx.get` 读，而不写进 `inject`，所以单运维的组合——没有账号体系、没有 viewer 服务——照样能打开管理端，只是不提谁登录。

</details>
