---
description: "宿主到桌面的链路，面向「回合跑在服务器、工作跑在本人机器上」的部署。"
kind: "package-reference"
---

# @deepseek-ai/dsh-desktop-link

[English](README.md) | 中文

## 概述

`dsh-desktop-link` 是「每位已签入的人一条、经过认证的通道」，宿主通过它请求那个人自己的机器干活。新的地方在方向：其他所有 Remote 面都是客户端到宿主，而这一条是宿主到客户端——因为 agent 回合在服务器上，而它要操作的文件与进程在那台笔记本上。它不需要新的传输：一条 Remote 流本来就在同一条逻辑流上承载宿主下行项与客户端上行项，走的是桌面自己开的那条载体，所以一台在 NAT 后面的桌面无需监听任何东西就能被到达。

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

服务端挂上链路与它的 Remote 面：

```yaml
- id: desktop-link
  name: '@deepseek-ai/dsh-desktop-link'
- id: desktop-link-controller
  name: '@deepseek-ai/dsh-desktop-link/controller'
```

服务端的能力提供者通过 `ctx.desktopLink` 到达某个人的机器：

```ts
import type { DesktopLink } from '@deepseek-ai/dsh-desktop-link'
import type { PersonId } from '@deepseek-ai/dsh-people'

declare const link: DesktopLink
declare const person: PersonId

for await (const item of link.call(person, 'subprocess', 'spawn', { command: 'true' })) {
  // every item the machine produced, then its final value last
  void item
}
```

桌面经 `desktopLink` 这个 Remote 命名空间接入，并用它挂载的那些能力来应答调用：

```ts
import { DesktopExecutor } from '@deepseek-ai/dsh-desktop-link/executor'

const executor = new DesktopExecutor()
const stop = executor.register('subprocess', {
  perform: async function* (operation, payload, signal) {
    void operation; void payload; void signal
    yield { exitCode: 0 }
  },
})
void stop
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**每人一条链路，最新的连接胜出。** 两台机器同时替一个人应答，会让「在我笔记本上跑这个」变得含糊，所以第二条连接是替换第一条、而不是与它并存；刚连上的那台，就是这个人正坐在前面的那台。

**一次调用是可迭代的，因为工作是边产出边到达的。** 一条命令的输出不是只在结尾才有；只要最终值的调用方迭代到底即可。处理器用「最后产出的那一项」表示终值，所以没有哪个处理器需要另加一个「这一项是结果」的标记。

**上行结束即链路结束。** 一台半关闭了上行的桌面已经不再应答，所以在途的每一次调用都以 `desktop-lost` 失败，而不是等一台永远不会回话的机器。

**桌面服务不了的调用会被拒绝，而不是被丢掉。** 一个等待回复而回复永不到来的宿主，分不清「能力缺失」与「机器慢」，于是整个回合会挂住，而不是说清缺了什么。

**链路属于这次调用所代表的那个人。** `attach` 从桌面出示的那个会话里读取 principal，所以一台桌面无法靠发送另一个名字来冒充别人接入。

-----

<a id="further-exploration"></a>
## 进一步探索

- [离开单操作者 Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.zh.md) —— 为什么回合在服务器上、而工作不在。
- [`dsh-request-principal`](../../identity/request-principal/README.zh.md) —— 接入者是谁从哪里来。
- [`dsh-api-gateway`](../gateway/README.zh.md) —— 那条载体，以及覆盖它的那套测试。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它在宿主与一台机器之间运送工作。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **只有一个能力搭乘它** —— [`dsh-fs-desktop`](../../fs/fs-desktop/README.zh.md)，而随包 profile 还没有组合它，所以这条链路在生产里什么都不运。
- **没有输入方向** —— 一次调用只携带一次参数。运行途中还要被继续喂数据的能力——子进程的 stdin、终端的按键、一次改变窗口大小——没有通道可走，所以 `subprocess-desktop` 要先扩展请求词汇表才写得出来。
- **所有东西共用一条队列** —— 每次调用的项都多路复用到同一条逻辑流上，所以一次话多的调用，与发往那台机器的其他所有调用共享队列。
- **还没有执行器插件** —— `DesktopExecutor` 是一个由桌面组合驱动的类；开流并喂它的那个插件尚未写。
- **每人一台机器** —— 一个同时有笔记本与工作站的人只能到达最后连上的那台，没有办法点名另一台。
- **没有背压** —— 排队的请求与已投递的项都放在内存里，所以一台停止消费的桌面会让队列增长，而不是让宿主慢下来。

**Runtime invariant:** 不发布任何 companion。每条链路都是一个只有单一观察者的内存关系，而链路丢失是通过随它一起失败的那些调用被观察到的。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

线上走的是 JSON，所以排队的项永远不会是 `undefined`——空值是 `null`。正是这一点让 `call` 可以把「取不出来」当成空队列；有一个测试钉住：一个 `null` 项会被投递，而不是被跳过。

`release` 无条件删除已记录的链路：被替换掉的那条，在替换方自己的 `close` 里就已经关闭，而已关闭的那条会提前返回，所以函数体只会为当前那条运行。

</details>
