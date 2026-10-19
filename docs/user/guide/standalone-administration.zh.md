# 部署与管理一套独立安装

[English](standalone-administration.md) | 中文

这份指南讲的是跑在你自己服务器上的部署：实施的人要做一次的事，以及此后管理员每天做的事。上半篇是安装，下半篇是管理员此后工作的那个后台——在那里配登录，不用再改任何文件。

跑在你自己硬件上的部署，服务的是你自己的员工：它有账户，没有积分计量。余额、额度与按人配额属于托管服务，在这里是缺席，而不是被设成零。

## 上半篇：把它装起来

### 建 profile

装好 Node.js，然后用 `enterprise` 模板、以你自己起的名字建一个 profile：

```sh
npx @lyness/lyn --profile acme --from-default-profile enterprise
```

这会写出 `$LYNESS_HOME/profiles/acme/`——一份记着 bundle 顺序的 `package.json`，和一份属于你自己的组合层 `cordis.patch.yml`。第一次启动会拒绝开机，报错也会说清原因：这套部署还没说出自己的人是谁。这个拒绝是设计，不是故障——没有任何东西该替一套安装编出谁是管理员。

### 说出你的人

把人员名册写进 profile 的 `cordis.patch.yml`：

```yaml
- id: people
  name: '@lyness/lyn-people/static'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
      - id: bea
        displayName: Bea
        role: member
```

共有三种角色。`platform-administrator` 管整套部署；`tenant-administrator` 管一个组织，并用 `organization:` 字段点名那个组织；`member` 谁也不管。在独立部署里，运行它的人就是平台管理员。

`id` 是永久的：会话、发放与登录绑定都写在它上面。挑一个稳定的，比如工号或账号名，而不是显示名。

### 放第一位管理员进来

登录分两半。**渠道**负责拿某个目录——企业微信、钉钉或飞书——认出一个人；**准入绑定**负责说出那个目录身份对应你名册里的哪个人。空的绑定列表谁也不放进来，这是刻意的：接上一个目录，本身不应该等于让那个目录里的所有人都能登录。

第一位管理员在登录之前什么也配不了，所以他的渠道与绑定写在同一份文件里，写一次：

```yaml
- id: sign-in-channel-head-office
  name: '@lyness/lyn-wecom'
  config:
    corpId: ww-your-corp-id
    agentId: '1000002'
    secret: WECOM_APP_SECRET

- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: wecom
        issuer: ww-your-corp-id
        subject: ada-wecom-userid
        person: ada
```

`issuer` 与 `subject` 是目录自己报出来的东西：企业微信是 corpid 与成员的 UserId，钉钉是 corpid 与此人的 unionId，飞书是 tenant key 与 union id。这些在目录自己的后台里能看到。`channel` 是渠道的标识——写在这里的那种就是 `wecom`、`dingtalk`、`feishu`；此后从界面加的渠道有自己的标识，那一页会显示出来。

### 把第一把密钥交给它

`secret:` 写的是凭据引用名，而不是密钥本身。第一次启动之前还没有后台可以输入，所以这个值从环境来：

```sh
WECOM_APP_SECRET=... npx @lyness/lyn --profile acme
```

继承来的环境变量压过其余一切，而且在产品内部改不了——这正是它适合放引导密钥的原因。想让它熬过重启，就改写 `$LYNESS_HOME/.env`，并把权限设成 `600`。此后从后台保存的密钥存在 `$LYNESS_HOME/.credentials.yaml`，由产品自己读写。

### 启动

```sh
npx @lyness/lyn --profile acme --port 8080 --no-open
```

profile 之后的参数属于 Web 应用：`--host`、`--port`、`--trusted-host`、`--no-open`。想不启动地检查组合出来的树，用 `--dump-config`。

然后把这份指南的下半篇交给客户的管理员。

## 下半篇：把它管起来

以下都发生在产品里，不用改文件，也不用重启。

### 配置渠道

打开**设置 → 登录**。这一页列出这套部署正在服务的渠道，并给出一个添加表单。选目录、起按钮名、填那个目录需要的设置——企业微信要 corpid 与 agentid，钉钉要 AppKey，飞书要 App ID——再打上应用密钥。保存会把密钥存进凭据存储、把渠道挂起来，登录屏立刻就有它。

每一行都说出这个渠道是不是**服务中**。读作**未服务**的那一行，是存着但没挂上：这个部署没有挂那个种类的插件，或者那个种类拒绝了这些设置。改好设置再保存即可，记录一直留着，不用重打一遍。

每一行还会显示**渠道标识**。准入绑定据此点名这个渠道——从界面加的渠道有自己的标识，于是为它写的绑定不会放任何人从别的渠道进来，哪怕那是同一个种类的另一个渠道。

### 把其余员工加进来

今天加一个人仍然是对 profile 的两处编辑：名册里加一行，再加一条点名其目录身份的绑定。登录页是运行时可配的，名册还不是。批量加人时请把这件事算进计划。

### 轮换密钥

编辑那个渠道，打上新密钥，保存。密钥一栏留空表示沿用已经存着的那把，所以改个名字从来不意味着重打一把谁也读不回来的密钥。没有第二个槽位：总有一刻是两者之一在生效，所以等目录那边已经接受了新密钥再轮换。

### 删除渠道

删除一个渠道，等于掐掉所有经由它登录的人的入口，并删掉它的应用密钥。这一页在做这两件事之前都会要一次确认。为那个渠道写过的绑定会留在 profile 里，但谁也放不进来，因为再没有渠道报出那个标识。

### 谁能做什么

配置渠道需要管理员身份。打开这一页的普通成员只会读到一句「只有管理员能配置登录」，别的什么也看不到。在有组织的部署上，租户管理员只配置本组织的渠道，部署级的那些碰不到。

## 继续

- [配置模型](./providers.zh.md)
- [使用 Web UI](./index.zh.md)
