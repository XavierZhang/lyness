---
kind: upgrade-guide
description: "管理页从设置里搬到 /admin 的管理端，页面改为注册 admin.section。"
---

# 管理端是一个页面，不再是设置里的一个平面

[English](guide.md) | 中文

## 变更

管理页——模型、内置插件、Agent 模式、登录渠道、人员、机器人、额度、变更历史——不再出现在设置窗口里。它们渲染在管理端：一个独立的页面，路径 `/admin`，有自己的导航和自己的登录页。设置里只剩一个平面：一个人自己为自己决定的那些事。

随之变化的有三处：

| 变更前 | 变更后 |
|---|---|
| slot `settings.administration.section` | slot `admin.section`，由 `lyn-client-ui-admin-console` 声明 |
| `lyn-host-frontend-static` 只在 `/` 给出 index | `documentPaths: ['/admin']` 让它也用文档作答那个路径 |
| `lyn-web-app` 没有页面配置 | `documentPaths` 把这些路径透传给 dist 服务 |

`SettingsRootInjected.hooks` 去掉了 `administrationSections` 与 `administers`，`lyn-client-ui-settings-general` 不再导出 `administersSource`。

受影响的是：自行组合客户端行的部署、注册管理页的插件，以及读过那两个 hook 的东西。使用产品的人看到的设置少了「管理」那一组；管理员打开 `/admin`。

## 迁移

1. 在同一份组合里把管理端和它所在的页面都组合进去：
   ```yaml
   - id: web-runtime
     name: '@lyness/lyn-web-app'
     config:
       documentPaths:
         - /admin
   - id: ui-admin-console
     name: '@lyness/lyn-client-ui-admin-console'
     config:
       path: /admin
   ```
   两处路径必须一致：宿主决定哪些路径给出文档，`path` 决定其中哪一个是管理端。`documentPaths` 的每一项是一个绝对路径段，例如 `/admin`。
2. 自己持有的管理页改名字：`ctx.slots.inject('admin.section', …)`、`name: 'admin.section'`，以及组件里的 `PropsRuntime<'admin.section'>`。owner 份额没变，组件别处不用改。
3. 自行替换设置外壳的话，去掉对 `administrationSections` 与 `administers` 的读取；管理端自己从 `ctx.uiViewer` 与 `admin.section` 决定提供什么。
4. 验证：打开 `/admin`，应看到管理端与你的组合挂载的那些页；打开设置，它们不再在里面。`apps/web/tests/admin-console.e2e.ts` 用真实浏览器断言了这两件事。
