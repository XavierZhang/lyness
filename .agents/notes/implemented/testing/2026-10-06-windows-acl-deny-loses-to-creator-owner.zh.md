# Agent Note：CREATOR OWNER 的允许压过 Windows 沙箱的容器拒绝

Status: implemented

[English](2026-10-06-windows-acl-deny-loses-to-creator-owner.md) | 中文

## 问题

`packages/sandbox/sandbox-windows-acl` 通过给授权根目录添加一条只向容器继承的拒绝 ACE 来限制工作区。`runner.spec.ts` 钉住这条拒绝的既定代价：根目录内的文件 `FullControl` 打开成功，目录打开失败，因为 `FILE_DELETE_CHILD` 是在容器上求值的。在本 fork 的托管 `windows-2025` runner 上，目录打开成功了，于是该用例每轮必挂，而在上游的 Windows 池上一直通过。

证据到手前有两个判断是错的。第一个归咎于备份语义：探针用 `FILE_FLAG_BACKUP_SEMANTICS` 打开目录，该标志在 `SeBackupPrivilege` 启用时会绕过 ACL，而这个 runner 是 High Mandatory Level 的管理员。打印令牌证伪了它——`SeBackupPrivilege`、`SeRestorePrivilege`、`SeTakeOwnershipPrivilege` **全是 Disabled**，而禁用的特权不参与访问检查。第二个归咎于 ReFS，它的继承语义与 NTFS 不同。临时盘是 NTFS。

## 决定

不依赖产品代码复现同一序列后结论明确。先建根目录与子目录，再给根目录加上向容器继承的拒绝：

```text
root : runneradmin:(CI)(DENY)(DE)

child: NT AUTHORITY\SYSTEM:(OI)(CI)(F)
       runneradmin:(OI)(CI)(F)
       runneradmin:(I)(CI)(DENY)(DE)
       runneradmin:(I)(OI)(CI)(F)
```

第二行是显式的，第三行是继承来的拒绝。所以拒绝确实传播了，但它输了。该 runner 的 `%TEMP%` 带有 `CREATOR OWNER` 可继承项，因此其下新建的每个目录都会获得一条**非继承的** `FullControl` 允许，授予创建者。Windows 按规范顺序求值 DACL——显式拒绝、显式允许、继承拒绝、继承允许——显式允许先于继承拒绝被命中，于是打开被放行。这个 runner 上缺的是用例的前提，不是它的断言错了。

因此 Windows 覆盖率任务把 `TMP` 与 `TEMP` 指向一个用 `icacls /inheritance:r` 重置继承、再给 SYSTEM 与 runner 账户授予可继承完全控制的暂存根目录。该根目录下的子目录对允许与拒绝一视同仁地继承，由规范顺序决定结果。产品沙箱一行未改，断言也保持效力：拒绝一旦停止传播，它仍会失败。

## 这件事对沙箱意味着什么

这套限制依赖一个它既不建立、也不检查的前提：授权根目录内的目录不带显式允许。`CREATOR OWNER` 可继承项在 `C:\Users\<账户>\` 下是常态，而工作区通常就在那里，所以真实部署可能落到与 runner 相同的状态——容器拒绝传播了，然后被压过。要堵上这个缺口，这道能力缝要么读取每个待拒绝容器的有效 DACL，要么下显式拒绝而非继承拒绝。

这是上游的设计，只是因为一台托管 runner 恰好暴露了它才被发现。本 fork 自己承担这个问题而不上报上游；沙箱代码暂不改动，理由与归属无关，而是关于证据。

产出 `DIRECTORY: OK` 的探针用 `spawnSync('pwsh', ...)`，跑的是 runner 的普通令牌。它击穿的那条拒绝针对 world SID，所以被打破的断言——连不受限进程也打不开该容器——是真实的，而且是这套用例两个主张里更强的那个。探针**没有**确立的，恰是决定严重性的那个：受限写令牌下的沙箱进程是否同样能命中那条 `CREATOR OWNER` 允许。账户相同，所以很可能能；但此处没有任何测量。

堵上这个缺口有两条路：对授权根内的每个容器下显式拒绝，那就得覆盖授权之后新建的目录；或者在信任继承拒绝之前读取每个容器的有效 DACL。两者都是对安全能力缝的改动，都需要在 Windows 主机上针对受限令牌验证，而本 fork 只能通过一次 CI 往返够到 Windows。在这种位置改能力缝就是猜。先有测量。

## 后果

Windows 覆盖率任务现在拥有一个暂存根目录和指向它的两个环境变量，改动那一步就会改变沙箱套件看到的环境。此后任何假定该任务使用默认 `%TEMP%` 的套件，拿到的是这个重置过的根目录；它给 SYSTEM 与 runner 账户授予可继承完全控制，即默认环境减去 `CREATOR OWNER` 那一条。

断言保持效力。产品一旦停止传播拒绝，或以会输给继承允许的形式传播，该用例仍会失败。它不再报告的，是 runner 自身的用户目录 ACL。

上面指出的缺口在产品侧仍然敞着。在一次受限令牌的测量确定沙箱进程是否够得到那条 `CREATOR OWNER` 允许之前，Windows 上的部署不应仅凭这套用例就认定目录限制已被证明；那次测量是下一步，它该在 Windows 主机上做，而不是在 CI 日志里做。

## 被否的方案

### 为什么不在这个 runner 上跳过该用例

仓库禁止绕过沙箱失败，而这条断言承载着真实的安全属性。跳过它也会把上面那个发现一并埋掉——它只因为这次失败被追查而非被消音才浮出来。

### 为什么不把断言放宽到两种结果都接受

无论拒绝是否生效都通过的断言，什么也没钉住。恢复前提的成本很低，这份覆盖不值得拿去交换。

### 为什么不把 Windows 覆盖率任务挪到自建池

那是掩盖差异而不是解释它，何况本 fork 没有自建池。暂存根目录只有三行，并写明了理由。
