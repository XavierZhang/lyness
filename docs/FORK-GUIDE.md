# lyness 二次开发手册

> 本手册由 fork-init 于 2026-08-29 生成，命令均**探测自源项目本身**，不是通用范例。
> 台账见 `CUSTOM.md`。

## 你的仓库长什么样

```text
upstream（官方，只读）  https://github.com/deepseek-ai/deepseek-harness.git  分支 master
        │ git fetch / git merge
        ▼
本地 lyness      分支 custom/main = 官方代码 + 你的改动
        │ git push
        ▼
origin（你的）          git@github.com:XavierZhang/lyness.git
```

口诀：**从 upstream 拿，往 origin 推，在 custom/main 上改。**
`upstream` 的 push 地址已被设为 DISABLED，推不上去是设计如此，不是故障。

## 开发环境

```bash
cd "/Users/xavierzhang/Documents/projects/ai/lyness"
pnpm install      # 安装依赖
pnpm dsh --profile headless "your prompt"        # 冒烟验证
```

本地地址：http://127.0.0.1:3080
官方开发文档：CONTRIBUTING.md README.md docs/development.md（命令有出入时以官方文档为准，并回来更新本手册）

## 日常开发

```bash
git checkout custom/main
git pull origin custom/main

git checkout -b feature/你的功能名
# —— 改代码 ——
pnpm run lint
pnpm run test
git add . && git commit -m "feat: 说清楚做了什么"

git checkout custom/main
git merge feature/你的功能名
git push
git branch -d feature/你的功能名
```

改完在 `CUSTOM.md` 里登记：动了哪个官方文件、为什么非改不可。
这张表是下次合并官方时唯一能救你的东西。

### 少制造未来的冲突

| 优先级 | 做法 | 为什么 |
|---|---|---|
| 高 | 优先新增文件，而不是改官方文件 | 新文件永远不冲突 |
| 高 | 能用配置/插件/扩展点解决就别动核心链路 | 核心链路是官方重构的重灾区 |
| 高 | 必须改官方文件时，改动集中、行数少 | 冲突范围 = 你改动的行数 |
| 中 | 不做全项目格式化、重排 import | 会让整个文件变成冲突 |
| 中 | 品牌类改动集中在常量/i18n/assets 少数几处 | 每次合并后只需复查几个点 |

## 同步官方更新（最重要）

建议官方发版后 1～2 周内同步一次。半年不同步，冲突会指数级变难。

**推荐用向导**（自动备份、预判冲突、跑验证、追加合并记录）：

```bash
bash ~/.claude/skills/fork-init/scripts/sync-upstream.sh
```

Windows 的 cmd / PowerShell 里：

```bat
%USERPROFILE%\.claude\skills\fork-init\scripts\run.cmd sync-upstream
```

**手动等价流程**：

```bash
cd "/Users/xavierzhang/Documents/projects/ai/lyness"
git checkout custom/main
git status                                    # 必须干净，否则先 commit 或 stash
git branch backup/before-merge-$(date +%Y%m%d)

git fetch upstream
git log custom/main..upstream/master --oneline          # 官方多了什么
git diff custom/main...upstream/master --stat           # 动了哪些文件 → 预判冲突

git merge upstream/master
# 有冲突 → 见下一节 → git add . → git merge --continue

pnpm install
pnpm run test
pnpm dsh --profile headless "your prompt"
git push origin custom/main
git tag -a custom-$(date +%Y%m%d) -m "合并官方后的稳定版" && git push origin --tags
```

合并完成后**必须**逐条复查 `CUSTOM.md` 里的「故意删除/禁用」和「品牌替换」两张表。

## 解决冲突

冲突标记里，`<<<<<<< HEAD` 到 `=======` 是**你的**，到 `>>>>>>>` 是**官方的**，三行标记本身要删掉。

| 情况 | 怎么选 |
|---|---|
| 产品名、Logo、文案 | 保留你的，必要时吸收官方新增文案 |
| 官方修了 bug，你没动过这段逻辑 | 取官方 |
| 官方加新功能，你也改了同一处 | 两边都要，手动合成 |
| 锁文件（lock 文件） | 别手改：`git checkout --theirs <锁文件>` 后重跑 `pnpm install` 重新生成 |
| 配置 schema / 数据库迁移 | 先读官方变更说明再决定兼容方式 |
| 完全看不懂 | 先取官方让项目能跑，再把你的定制一点点加回来 |

```bash
git diff --name-only --diff-filter=U     # 只列冲突文件
# —— 逐个改完 ——
grep -rn "<<<<<<<\|>>>>>>>" . --exclude-dir=.git     # 确认没有残留标记
git add . && git merge --continue
```

合坏了：`git merge --abort` 放弃本次合并；已经 commit 了用 `git reflog` 找回合并前的位置。

## 发版前检查

- [ ] 已合并最新 `upstream/master`，`CUSTOM.md` 已记录
- [ ] `git log upstream/master..custom/main --oneline` 只有你预期的提交
- [ ] 没有提交真实密钥、`.env`、本地数据库、日志
- [ ] `CUSTOM.md` 的定制点逐条复查，未被官方覆盖
- [ ] 品牌、域名、关于页已是 lyness，不冒充官方
- [ ] 分发包内保留 `LICENSE` 和第三方声明
- [ ] `pnpm install` / `pnpm run build` / `pnpm run test` / `pnpm dsh --profile headless "your prompt"` 全部通过
- [ ] 不占用官方包名、镜像名、域名、Logo

## 许可证

源项目许可证：**MIT**

| 许可证 | 闭源分发 | 关键义务 |
|---|---|---|
| MIT / BSD / Apache-2.0 | 通常可以 | 保留版权与许可声明；Apache-2.0 还需标注你做过修改并保留 NOTICE |
| MPL-2.0 | 可以 | 被你修改的**原文件**需继续开源 |
| GPL-3.0 | 分发即需开源 | 分发二进制须提供完整对应源码 |
| AGPL-3.0 | 提供网络服务即触发 | 通过网络提供服务也须开源 |
| BUSL / 自定义商业条款 | 视条款 | 必读 LICENSE 全文，可能需要商业授权 |

以上仅作方向判断，不是法律意见。正式商用分发前请让懂开源许可证的人过一遍。
