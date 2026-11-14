---
kind: upgrade-guide
description: "账号模块换上了一条认邀请码的准入规则，准入本身也多收一个「出示物」。"
---

# 准入开始认邀请码

[English](guide.md) | 中文

## 变更

一个部署只挂一条准入规则，而 `@deepseek-ai/dsh-module-accounts` 现在挂的是另一条。`@deepseek-ai/dsh-managed-people/admission` 只准入管理员绑定过的主体；`@deepseek-ai/dsh-invitations/admission` 准入那个主体，也准入出示了 `ctx.invitations` 签发过的码的人。两条读的是同一份 `bindings` 配置，所以一套写下了运维自己身份的安装不会丢掉它。模块因此多了一行 `invitations`——那条规则需要它。

随之变的有三处：

| 之前 | 之后 |
|---|---|
| `SignInAdmission.admit(subject)` | `admit(subject, offer?: AdmissionOffer)` |
| `signIn.begin(channel, returnTo)`、`resume(channel, parameters)` | 两者都多收一个可选的末位 `offer` |
| `/auth/sign-in/<channel>` 不看查询串 | `?invite=<code>` 被放进 `dsh_signin_invite` cookie 存 600 秒，到回调时出示 |

这三处的「出示物」都是可选的，所以什么都不传的调用方行为如旧，忽略第二个参数的规则也照样编得过。手里没有码的人看不出区别。管理员现在可以经 `ctx.invitations.issue` 签发一张——在管理端那一页落地之前，它还只是个服务调用。

## 迁移

1. 如果你 compose 的是 `@deepseek-ai/dsh-module-accounts`：不用做任何事，两行都在模块里。
2. 如果你自己的 composition 挂的是 `@deepseek-ai/dsh-managed-people/admission`，而你想要邀请码，就换掉那一行、并补上它需要的那个服务：
   ```yaml
   - id: invitations
     name: '@deepseek-ai/dsh-invitations'
   - id: sign-in-admission
     name: '@deepseek-ai/dsh-invitations/admission'
     config:
       bindings: []
   ```
   想让准入对码关着门，就保留受管那一行；关于它本身什么都没变。
3. 如果你自己实现了 `SignInAdmission`，决定第二个参数对你这条规则意味着什么。忽略它就保持今天的行为；像 `dsh-managed-people/admission` 那样把这件事写明。
4. 如果你从自己的界面上调 `signIn.begin` 或 `signIn.resume`、并希望一张码被认下来，就把它递下去：`begin(channel, returnTo, { invitation })`。永远不要把码放进你交给目录的 URL 里。
5. 确认它生效：用 `ctx.invitations.issue({ label, role, organization }, by)` 签一张码，然后在一个从未登录过的浏览器里打开 `/auth/sign-in/<channel>?invite=<code>`。那个人带着码所携带的标准进来，`ctx.invitations.list(by)` 报出一次使用。`packages/identity/invitations/tests/composition.spec.ts` 经真实 Loader 断言了这条路径。
