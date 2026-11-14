# 营销素材

对外推广用的能力点与文案。**不随文档站发布**：`marketing/` 不在 `docs/` 之内，文档门禁也不扫这里，所以是中文单语，不需要 `.zh.md` 与 `.i18n.yaml`。

索引文件叫 `index.md` 而不是 `README.md`：双语配对门禁按文件名收录「每个非 vendor README」，叫 README 就会被要求配一份英文译文。

| 文件 | 内容 |
|---|---|
| [能力与文案](capability-copy.md) | 九个能力点，每个配一句竞品对比、一条图文文案、一条短视频脚本，末尾是按平台的投放建议 |

## 用之前请核一遍

文案里的数字与机制都取自当前仓库，但产品在动。投放前重跑一次对应门禁，确认数字没变：

```sh
ls -d packages/*/*/ | wc -l                      # 插件包数
ls packages/bundle/ | wc -l                      # profile bundle 数
grep -c '^| `@lyness' docs/tool-catalog.md       # 工具包数
pnpm run verify-remote-authority                 # Remote 命名空间数
grep -n 'SHIPPED_LOCALE_IDS = ' scripts/shipped-locales.ts   # 出厂语言
```

## 两条写作约束

**对比只写「常见做法」，不点名竞品。** 竞品行为会变，点名就要逐一核实对方当前的实际行为；核实不了就写进对外文案是风险。要做点名对比，先定对手名单并逐条核实。

**主张落在可验证的机制上，不用形容词。** 「托管形态没有执行面」可以当场打开组合清单看；「我们很安全」不能。凡是不能在仓库里指出依据的说法，不要写进这里。
