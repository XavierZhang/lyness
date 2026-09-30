# lyness 品牌规范

[English](LYNESS-BRAND-GUIDELINES.md) | 中文

| 项 | 值 |
|---|---|
| 品牌 | **lyness** |
| 中文名 | **领驭** |
| 产品 | **企业级 AI Agent 编排平台** |
| 核心理念 | **Quiet Intelligence（克制的智能）** |
| 品牌原则 | **专业 · 可信 · 克制 · 技术** |

---

## 1. 品牌定义

**lyness** 是企业级 AI Agent 编排平台。

平台的设计目标是：

- 编排多个 AI Agent
- 协调 Agent 与工具
- 连接知识、工作流与数据
- 自动化复杂的企业任务
- 把 AI 的智能转化为可执行的工作流

中文品牌名是：

> **领驭**

它代表：

- **领**——引领、指引、协调
- **驭**——掌控、编排、驾驭

品牌应当传达：

> **Intelligence under control.（智能在掌控之中。）**

而不是 AI 魔法、AI 玩具、人形机器人或未来科幻。

---

## 2. 品牌性格

| 特质 | 含义 |
|---|---|
| 专业 | 企业级、可靠、有结构 |
| 可信 | 稳定、可预期、受控 |
| 克制 | 极简、安静、不张扬 |
| 技术 | 现代软件与 AI 技术 |
| 智能 | 先进而不夸张 |
| 编排 | 多个系统协同工作 |
| 方向感 | 引导、掌控与执行 |

### 核心短语

> **Quiet Intelligence**

中文释义：

> **克制的智能**

品牌应当让人感到智能，而不必装出「AI 未来感」。

---

## 3. 视觉策略

lyness 的视觉体系建立在：

```text
BLACK
  ↓
Authority / Platform / Trust

BLUE
  ↓
Control / Direction / Brand Identity

CYAN
  ↓
AI / Intelligence / Runtime

WHITE
  ↓
Clarity / Enterprise / Simplicity
```

视觉层级：

```text
Black → Structure
Blue  → Interaction
Cyan  → Intelligence
White → Space
Gray  → Information
```

---

# 4. 品牌色彩体系

## 4.1 核心品牌色

### Lyness Black

```text
HEX: #0B0D10
RGB: 11, 13, 16
```

语义含义：

- 平台
- 权威
- Logo
- 主文字
- 导航
- 企业身份

用于：

- Logo
- 主标题
- 导航
- 深色 UI 表面
- 重要的结构性元素

优先使用 Lyness Black，而非纯黑 `#000000`。

---

### Lyness Blue

```text
HEX: #315BFF
RGB: 49, 91, 255
```

这是**主品牌色**。

语义含义：

- 掌控
- 方向
- 动作
- 品牌识别
- 激活态
- 主要交互

用于：

- 主按钮
- 链接
- 激活的导航
- 选中元素
- Agent 动作
- 工作流动作
- 重要数据点
- CTA
- 品牌视觉元素

Lyness Blue 是 lyness 的首要视觉识别色。

---

### Lyness Deep Blue

```text
HEX: #1937B8
RGB: 25, 55, 184
```

语义含义：

- 纵深
- 悬停
- 按下
- 深蓝表面
- 强调

主要用于：

- 按钮悬停
- 按钮按下态
- 深蓝色 UI 区域
- 次级品牌图形

不要用 Deep Blue 取代 Lyness Blue 作为默认品牌色。

---

### Lyness Cyan

```text
HEX: #22B8D6
RGB: 34, 184, 214
```

语义含义：

- AI
- 智能
- 运行时
- 数据流
- Agent 活动
- 实时处理

用于：

- 运行中的 Agent
- AI 活动指示
- 数据流
- 运行时状态
- AI 可视化
- Agent 执行动画

Cyan 不得取代 Lyness Blue 成为主品牌色。

---

# 5. 中性色体系

## 5.1 White

```text
--lyness-white: #FFFFFF;
```

用于：

- 页面主背景
- 卡片
- 对话框
- 表单
- 文档
- 营销页面

## 5.2 Gray 50

```text
--lyness-gray-50: #F5F7FA;
```

用于：

- 应用背景
- 仪表盘背景
- 次级区块
- 留白区域

## 5.3 Gray 200

```text
--lyness-gray-200: #E5EAF2;
```

用于：

- 边框
- 分隔线
- 表格分隔
- 输入框边框
- 卡片描边

## 5.4 Gray 600

```text
--lyness-gray-600: #667085;
```

用于：

- 次要文字
- 描述
- 元数据
- 占位文字

## 5.5 Gray 900

```text
--lyness-gray-900: #1D2430;
```

用于：

- 正文
- 次级标题
- 重要的 UI 信息

---

# 6. 语义色

语义色**不是品牌色**，它们传达应用状态。

| 语义 | HEX | 含义 |
|---|---|---|
| Success | `#16A36A` | 完成／成功／健康 |
| Warning | `#D99000` | 警告／待处理／需注意 |
| Error | `#D64545` | 错误／失败／严重 |
| Info | `#315BFF` | 信息／系统提示 |

不要把语义色当作装饰使用。

---

# 7. 色彩令牌定义

前端必须通过设计令牌暴露整套品牌体系。

```css
:root {
  /* Brand */
  --lyness-black: #0B0D10;
  --lyness-blue: #315BFF;
  --lyness-blue-dark: #1937B8;
  --lyness-cyan: #22B8D6;

  /* Neutral */
  --lyness-white: #FFFFFF;
  --lyness-gray-50: #F5F7FA;
  --lyness-gray-200: #E5EAF2;
  --lyness-gray-600: #667085;
  --lyness-gray-900: #1D2430;

  /* Semantic */
  --lyness-success: #16A36A;
  --lyness-warning: #D99000;
  --lyness-error: #D64545;
  --lyness-info: #315BFF;
}
```

---

# 8. 推荐的 UI 色彩层级

默认的企业应用：

```text
Background       #F5F7FA
Card             #FFFFFF
Primary Text     #0B0D10
Secondary Text   #667085
Border           #E5EAF2
Primary          #315BFF
AI Runtime       #22B8D6
Success          #16A36A
Warning          #D99000
Error            #D64545
```

推荐的视觉比例：

```text
Neutral / White     70–85%
Black / Dark        10–20%
Blue                 5–10%
Cyan                 <5%
Semantic Colors      As required
```

UI 不得变成以蓝色或青色为主的画面。

---

# 9. Logo 规则

## 9.1 Logo 颜色

默认的 lyness logo 是：

```text
#0B0D10
```

置于：

```text
#FFFFFF
```

之上。Logo 应始终保持单色。

## 9.2 Logo 禁止事项

Logo 不得：

- 使用渐变
- 使用发光
- 使用阴影
- 使用 3D 效果
- 使用金属质感
- 使用纹理
- 使用多种颜色
- 被放进不必要的装饰形状中
- 与 AI 机器人形象组合
- 与电路板图案组合

## 9.3 Logo 概念

Logo 应当传达：

- 方向
- 掌控
- 编排
- 技术
- 简洁

不应传达：

- 机器人
- 大脑
- 鲸鱼
- 鱼
- 电路板
- 科幻
- 加密货币
- 游戏

---

# 10. 字体排印

## 10.1 总体原则

字体应当是：

- 几何的
- 现代的
- 无衬线的
- 干净的
- 高可读性的
- 中性的
- 面向企业的

避免装饰性字体。

## 10.2 推荐字体栈

Web：

```css
font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  Helvetica,
  Arial,
  sans-serif;
```

中文：

```css
font-family:
  Inter,
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans SC",
  sans-serif;
```

## 10.3 字标

正式字标：

```text
lyness
```

规则：

- 只用小写
- 拼写严格为 `l-y-n-e-s-s`
- 单行
- 不带图标
- 不带标语
- 不附加其他文字

---

# 11. 布局原则

lyness 的界面必须让人感到：

> 有结构、有余量、受控制。

除非产品场景确实需要高信息密度，否则避免密集布局。

优先的层级关系：

```text
Large whitespace
      ↓
Clear hierarchy
      ↓
Strong alignment
      ↓
Simple components
      ↓
Minimal decoration
```

使用 8px 间距体系。

推荐间距：

```text
4px
8px
12px
16px
24px
32px
40px
48px
64px
80px
96px
```

优先取 8px 的倍数。

---

# 12. 圆角

lyness 采用克制的圆角。

推荐：

```text
Small:   6px
Medium:  8px
Large:   12px
Card:    12px
Modal:   16px
```

大容器避免使用 `9999px`。

胶囊形只应用于：

- 标签
- 状态
- 小型控件
- 筛选器

---

# 13. 边框

默认边框：

```css
border: 1px solid #E5EAF2;
```

边框应当克制。

避免：

- 粗边框
- 装饰性边框
- 发光边框
- 无语义含义的彩色边框

---

# 14. 阴影

lyness 使用非常轻微的阴影。

推荐：

```css
box-shadow:
  0 1px 2px rgba(11, 13, 16, 0.04);
```

用于抬升的组件：

```css
box-shadow:
  0 8px 24px rgba(11, 13, 16, 0.08);
```

不要使用：

- 霓虹发光
- 浓重的黑色阴影
- 彩色光晕
- 未来感悬浮效果

---

# 15. 按钮体系

## Primary

```text
Background: #315BFF
Text:       #FFFFFF
```

悬停／按下：

```text
#1937B8
```

## Secondary

```text
Background: #FFFFFF
Text:       #1D2430
Border:     #E5EAF2
```

## Ghost

```text
Background: transparent
Text: #315BFF
```

## Destructive

```text
#D64545
```

仅用于破坏性操作。

不要把红色当作装饰性品牌色使用。

---

# 16. Agent 视觉语言

lyness 是 Agent 编排平台。

使用下列语义体系：

| 对象 | 颜色 | 含义 |
|---|---|---|
| Platform | `#0B0D10` | lyness 平台／编排层 |
| Agent | `#315BFF` | 活跃的 AI Agent |
| Running Agent | `#22B8D6` | AI 执行／运行时 |
| Human | `#667085` | 人类参与者／审批 |
| Tool | `#7C5CFC` | 外部工具或服务 |
| Knowledge | `#0EA5A8` | 知识库／文档／检索 |
| Success | `#16A36A` | 执行成功 |
| Error | `#D64545` | 执行失败 |

`#7C5CFC` 与 `#0EA5A8` 仅为语义 UI 色，不是核心品牌色。

---

# 17. Agent 工作流可视化

一个典型的 lyness 工作流应当传达：

```text
                    Agent A
                       │
                       ▼
                    Agent B
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Knowledge       Tool        Agent C
          │            │            │
          └────────────┼────────────┘
                       ▼
                     Result
```

视觉规则：

- Agent 节点：Lyness Blue
- 运行态：Lyness Cyan
- 连接线：灰色／蓝色
- 知识：语义青绿
- 工具：语义紫色
- 人工审批：灰色
- 成功：绿色
- 失败：红色

避免颜色过多。

---

# 18. AI 运行时动效

动效应当传达：

> 活动、流动与执行。

推荐：

- 轻微的脉冲
- 流动的连接线
- 进度指示
- 节点激活
- 状态切换

避免：

- 粒子爆炸
- 霓虹发光
- 过量粒子
- 旋转的 3D 物体
- 炫技效果

动效应当是功能性的，而非装饰性的。

推荐时长：

```text
Fast:   120–180ms
Normal: 200–300ms
Slow:   400–600ms
```

---

# 19. 深色模式

支持深色模式。

基础：

```text
Background: #0B0D10
Surface:    #11151C
Surface 2:  #171C25
```

文字：

```text
Primary:   #FFFFFF
Secondary: #AAB2C0
```

品牌：

```text
Primary Blue: #315BFF
AI Cyan:      #22B8D6
```

深色模式不得引入：

- 霓虹紫
- 发光渐变
- 过量青色
- 赛博朋克风格

深色模式应当保持：

> 企业 + 技术 + 克制。

---

# 20. Web 设计规则

lyness 官网应当使用：

```text
White
+
Black
+
Lyness Blue
+
Small amount of Cyan
```

Hero 区块通常应为：

```text
White background
Black typography
Blue CTA
Minimal AI visualization
```

推荐结构：

```text
Headline
    ↓
Product explanation
    ↓
Primary CTA
    ↓
Agent orchestration visualization
    ↓
Product capabilities
    ↓
Enterprise scenarios
```

避免：

- 巨大的发光 AI 大脑
- 人形机器人
- 未来都市
- 过量渐变
- 泛化的神经网络图像
- 人物凝视全息影像的图库照片

---

# 21. 应用设计规则

默认的应用背景：

```text
#F5F7FA
```

卡片：

```text
#FFFFFF
```

导航：

```text
#0B0D10
```

主操作：

```text
#315BFF
```

AI 活动：

```text
#22B8D6
```

优先级：

1. 信息层级
2. 工作流清晰度
3. 操作清晰度
4. 状态可见性
5. 企业可读性

视觉装饰是次要的。

---

# 22. 仪表盘设计

仪表盘必须优先保证：

```text
Data
Hierarchy
Comparison
Status
Action
```

推荐的图表配色顺序：

```text
#315BFF
#22B8D6
#1937B8
#667085
```

不要自动生成彩虹配色的图表。

除非每种颜色都有明确语义，否则避免使用多种颜色。

---

# 23. AI 生成视觉／IP 规范

任何由 AI 生成的 lyness IP、插画、吉祥物或营销视觉都必须遵循以下原则。

## 核心视觉概念

IP 应当代表：

> **一个引导、协调并掌控多个 Agent 的智能编排体。**

优先的概念：

- 领航者
- 向导
- 指挥者
- 协调者
- 控制者
- 抽象的智能体
- 几何形的伙伴
- 方向性符号

避免写实的人形机器人。

---

# 24. IP 视觉风格

优先：

```text
Minimal
Geometric
Modern
Intelligent
Calm
Enterprise
Abstract
Friendly but professional
```

优先的材质：

- 哑光
- 平滑
- 干净
- 扁平矢量
- 必要时的极简 3D

避免：

- 金属科幻
- 镀铬
- 光泽塑料
- 赛博朋克
- 过量全息
- 复杂机械部件

---

# 25. IP 色彩规则

主色：

```text
#0B0D10
#315BFF
#22B8D6
#FFFFFF
```

辅色：

```text
#1937B8
#F5F7FA
#E5EAF2
```

IP 应主要使用：

```text
Black + Blue + White
```

Cyan 可用于：

```text
AI / energy / activity / intelligence
```

Cyan 在视觉上应始终从属于 Blue。

---

# 26. AI 生图提示词模板

```text
Create a premium enterprise technology visual for Lyness,
an AI Agent orchestration platform.

Brand concept:
"Quiet Intelligence"

The visual should communicate:
intelligence, orchestration, coordination, control,
direction and enterprise reliability.

Visual style:
minimal, geometric, sophisticated, restrained,
modern enterprise software aesthetic,
clean composition, strong visual hierarchy.

Brand colors:
Lyness Black #0B0D10,
Lyness Blue #315BFF,
Lyness Cyan #22B8D6,
White #FFFFFF.

Use Lyness Blue as the primary accent color.
Use Lyness Cyan only as a secondary AI/runtime accent.

The visual should feel intelligent and technological
without looking futuristic or cyberpunk.

Use generous negative space,
clean geometry and precise shapes.

No unnecessary decoration.
No visual noise.
No excessive gradients.
```

---

# 27. IP 生成负面提示词

```text
cyberpunk,
neon,
futuristic city,
humanoid robot,
robot head,
brain,
neural network brain,
circuit board,
whale,
fish,
marine animal,
cryptocurrency,
gaming character,
cute toy,
anime,
excessive gradients,
rainbow colors,
purple dominant,
pink dominant,
glowing effects,
lens flare,
chrome,
metallic surface,
complex mechanical parts,
busy background,
photorealistic human,
stock photo,
watermark,
text,
logo,
typography,
mockup
```

---

# 28. IP 角色方向

如果要创建 IP 角色，它应当让人感到：

> 一位冷静的智能协调者。

优先的性格：

- 冷静
- 智能
- 可靠
- 自信
- 专注
- 乐于协助
- 精确

避免：

- 幼稚
- 过度可爱
- 夸张情绪
- 攻击性
- 超级英雄
- 漫画风格

---

# 29. 营销插画方向

营销插画应当把这些概念可视化：

```text
Agent orchestration
      ↓
Multiple Agents
      ↓
Tools
      ↓
Knowledge
      ↓
Workflow
      ↓
Enterprise Result
```

推荐的隐喻：

```text
             Agent
               │
               ▼
Agent ───► Lyness ───► Tool
               │
               ▼
           Knowledge
               │
               ▼
             Result
```

lyness 平台在视觉上应当被表现为编排中心。

---

# 30. 图标

图标应当：

- 简洁
- 几何
- 统一
- 2D
- 线性或填充风格
- 适当处使用圆角

推荐描边：

```text
1.5px – 2px
```

避免：

- 高度精细的图标
- 3D 图标
- 彩色图标包
- 风格不一致的图标

---

# 31. 渐变规则

渐变**不属于 lyness 的核心识别**。

默认：

> 不使用渐变。

如果某个营销视觉确实需要渐变，只允许：

```text
#315BFF → #22B8D6
```

示例：

```css
background:
  linear-gradient(
    135deg,
    #315BFF 0%,
    #22B8D6 100%
  );
```

渐变不得用于：

- Logo
- 常规按钮
- 主标题文字
- 整个 UI
- 替代品牌结构

---

# 32. 禁止的视觉语言

以下风格明确**不属于 lyness**：

```text
Cyberpunk AI
Neon AI
Sci-fi robot
AI brain
Circuit-board AI
Holographic interface
Rainbow gradient
Purple AI everywhere
Cute chatbot mascot
Gaming interface
Crypto/Web3 aesthetic
Excessive glassmorphism
Excessive 3D
```

---

# 33. 毛玻璃

毛玻璃不是 lyness 的默认风格。

避免：

- 重度模糊
- 到处都是透明卡片
- 强烈光晕
- 玻璃面板叠玻璃面板

若用于营销 Hero：

- 少量使用
- 保持强对比
- 保持企业级可读性
- 绝不取代主要的 UI 结构

---

# 34. AI 编码 Agent 规则

AI 编码 Agent 创建或修改 lyness UI 时，必须遵循本文档。

## MUST

编码 Agent **必须**：

- 使用 lyness 设计令牌
- 使用已定义的色彩体系
- 保持品牌层级
- 恰当使用语义色
- 保持足够对比度
- 优先复用既有组件，而非引入不一致的新样式
- 复用间距与圆角令牌
- 保持 UI 视觉克制
- 保持 Agent／工作流状态的语义一致

## SHOULD

编码 Agent **应当**：

- 复用既有设计令牌
- 复用既有组件
- 优先使用 CSS 变量
- 优先使用 8px 间距
- 优先使用简单布局
- 尽量减少不必要的视觉效果
- 保持动效的功能性
- 保持页面的视觉余量

## MUST NOT

编码 Agent **禁止**：

- 引入任意的品牌色
- 用紫色替代 Lyness Blue
- 制造彩虹渐变
- 添加霓虹效果
- 添加不必要的发光
- 默认添加机器人形象
- 添加 AI 大脑形象
- 在 Logo 上使用渐变
- 未经明确指示改变 Logo 颜色
- 制造风格不一致的按钮
- 制造过度圆角的卡片
- 添加没有功能目的的装饰性 UI

---

# 35. AI 设计 Agent 规则

AI 设计 Agent 为 lyness 生成视觉概念时，必须先明确：

```text
1. What is being represented?
2. What is its semantic role?
3. Which brand color represents it?
4. Is the visual functional or decorative?
5. Does it preserve Quiet Intelligence?
```

出现以下情况时应否决该设计：

```text
Visual complexity > Information value
```

或：

```text
Decoration > Product meaning
```

---

# 36. 品牌决策框架

视觉决策存在不确定时，按此优先级排序：

```text
1. Brand consistency
2. Product meaning
3. Usability
4. Information hierarchy
5. Accessibility
6. Visual aesthetics
7. Decorative effects
```

绝不把装饰置于可用性之上。

---

# 37. TypeScript 设计令牌

```ts
export const lynessColors = {
  black: "#0B0D10",
  blue: "#315BFF",
  blueDark: "#1937B8",
  cyan: "#22B8D6",

  white: "#FFFFFF",
  gray50: "#F5F7FA",
  gray200: "#E5EAF2",
  gray600: "#667085",
  gray900: "#1D2430",

  success: "#16A36A",
  warning: "#D99000",
  error: "#D64545",
  info: "#315BFF",
} as const;
```

---

# 38. Tailwind 映射

```text
theme: {
  extend: {
    colors: {
      lyness: {
        black: "#0B0D10",
        blue: "#315BFF",
        "blue-dark": "#1937B8",
        cyan: "#22B8D6",

        white: "#FFFFFF",
        "gray-50": "#F5F7FA",
        "gray-200": "#E5EAF2",
        "gray-600": "#667085",
        "gray-900": "#1D2430",

        success: "#16A36A",
        warning: "#D99000",
        error: "#D64545",
        info: "#315BFF",
      }
    }
  }
}
```

示例：

```html
<button class="bg-lyness-blue text-white">
  Create Agent
</button>
```

---

# 39. 组件命名

组件应使用语义化名称。

推荐：

```text
AgentCard
AgentStatus
AgentNode
AgentWorkflow
WorkflowCanvas
KnowledgeCard
ToolCard
RunStatus
ExecutionTimeline
ApprovalPanel
AgentSelector
```

避免含糊的名称：

```text
BlueBox
CoolCard
AICard2
MagicButton
FancyPanel
```

---

# 40. 项目级 Agent 集成

推荐的项目结构：

```text
lyness/
├── AGENTS.md
├── LYNESS-BRAND-GUIDELINES.md
├── docs/
│   └── design/
│       └── brand-guidelines.md
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   └── styles/
│       ├── tokens.css
│       ├── theme.css
│       └── components.css
└── ...
```

推荐写入 `AGENTS.md` 的规则：

```markdown
## Brand Design Requirement

For every Web/App UI implementation, read and follow:

`LYNESS-BRAND-GUIDELINES.md`

This document is mandatory for all Lyness frontend and visual development.

Do not introduce new brand colors, visual styles, gradients,
animations, illustrations, icons, or UI patterns that conflict
with the Lyness Brand Guidelines without explicit approval.

The design principle is:

> Quiet Intelligence.
```

---

# 41. 速查表

## 品牌

```text
Name:
lyness

Chinese:
领驭

Positioning:
Enterprise AI Agent Orchestration Platform

Concept:
Quiet Intelligence
```

## 核心色

```text
Black
#0B0D10

Blue
#315BFF

Deep Blue
#1937B8

Cyan
#22B8D6

White
#FFFFFF
```

## 中性色

```text
Gray 50
#F5F7FA

Gray 200
#E5EAF2

Gray 600
#667085

Gray 900
#1D2430
```

## 语义色

```text
Success
#16A36A

Warning
#D99000

Error
#D64545

Info
#315BFF
```

---

# 42. 一句话品牌准则

> **lyness 应当看起来智能、受控、可信——绝不喧哗、炫目或噱头。**

> **Quiet Intelligence. Powerful Orchestration.**
