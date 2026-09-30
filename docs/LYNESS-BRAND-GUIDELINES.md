# LYNESS Brand Guidelines

English | [中文](LYNESS-BRAND-GUIDELINES.zh.md)

| Field | Value |
|---|---|
| Brand | **lyness** |
| Chinese name | **领驭** |
| Product | **Enterprise AI Agent Orchestration Platform** |
| Core concept | **Quiet Intelligence** |
| Brand principle | **Professional · Trustworthy · Restrained · Technical** |

---

## 1. Brand Definition

**lyness** is an enterprise AI Agent orchestration platform.

The platform is designed to:

- Orchestrate multiple AI Agents
- Coordinate Agents and tools
- Connect knowledge, workflows and data
- Automate complex enterprise tasks
- Turn AI intelligence into executable workflows

The Chinese brand name is:

> **领驭**

It represents:

- **领** — lead, guide, coordinate
- **驭** — control, orchestrate, command

The brand should communicate:

> **Intelligence under control.**

Not AI magic, AI toys, humanoid robots, or futuristic sci-fi.

---

## 2. Brand Personality

| Attribute | Meaning |
|---|---|
| Professional | Enterprise-grade, reliable and structured |
| Trustworthy | Stable, predictable and controlled |
| Restrained | Minimal, quiet and non-flashy |
| Technical | Modern software and AI technology |
| Intelligent | Advanced but not exaggerated |
| Orchestrated | Multiple systems working together |
| Directional | Guidance, control and execution |

### Core phrase

> **Quiet Intelligence**

Chinese interpretation:

> **克制的智能**

The brand should feel intelligent without trying to look "AI futuristic".

---

## 3. Visual Strategy

The Lyness visual system is based on:

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

Visual hierarchy:

```text
Black → Structure
Blue  → Interaction
Cyan  → Intelligence
White → Space
Gray  → Information
```

---

# 4. Brand Color System

## 4.1 Core Brand Colors

### Lyness Black

```text
HEX: #0B0D10
RGB: 11, 13, 16
```

Semantic meaning:

- Platform
- Authority
- Logo
- Primary text
- Navigation
- Enterprise identity

Use for:

- Logo
- Main headings
- Navigation
- Dark UI surfaces
- Important structural elements

Prefer Lyness Black over pure `#000000`.

---

### Lyness Blue

```text
HEX: #315BFF
RGB: 49, 91, 255
```

This is the **primary brand color**.

Semantic meaning:

- Control
- Direction
- Action
- Brand recognition
- Active state
- Primary interaction

Use for:

- Primary buttons
- Links
- Active navigation
- Selected elements
- Agent actions
- Workflow actions
- Important data points
- CTA
- Brand visual elements

Lyness Blue is the primary visual recognition color of Lyness.

---

### Lyness Deep Blue

```text
HEX: #1937B8
RGB: 25, 55, 184
```

Semantic meaning:

- Depth
- Hover
- Pressed
- Dark blue surfaces
- Strong emphasis

Use primarily for:

- Button hover
- Button pressed state
- Dark blue UI areas
- Secondary brand graphics

Do not use Deep Blue as the default brand color instead of Lyness Blue.

---

### Lyness Cyan

```text
HEX: #22B8D6
RGB: 34, 184, 214
```

Semantic meaning:

- AI
- Intelligence
- Runtime
- Data flow
- Agent activity
- Real-time processing

Use for:

- Running Agent
- AI activity indicators
- Data flow
- Runtime status
- AI visualization
- Agent execution animation

Cyan must not replace Lyness Blue as the primary brand color.

---

# 5. Neutral Color System

## 5.1 White

```text
--lyness-white: #FFFFFF;
```

Use for:

- Main page backgrounds
- Cards
- Dialogs
- Forms
- Documentation
- Marketing pages

## 5.2 Gray 50

```text
--lyness-gray-50: #F5F7FA;
```

Use for:

- Application background
- Dashboard background
- Secondary sections
- Empty areas

## 5.3 Gray 200

```text
--lyness-gray-200: #E5EAF2;
```

Use for:

- Borders
- Dividers
- Table separators
- Input borders
- Card outlines

## 5.4 Gray 600

```text
--lyness-gray-600: #667085;
```

Use for:

- Secondary text
- Descriptions
- Metadata
- Placeholder text

## 5.5 Gray 900

```text
--lyness-gray-900: #1D2430;
```

Use for:

- Body text
- Secondary headings
- Important UI information

---

# 6. Semantic Colors

Semantic colors are **not brand colors**. They communicate application state.

| Semantic | HEX | Meaning |
|---|---|---|
| Success | `#16A36A` | Completed / Successful / Healthy |
| Warning | `#D99000` | Warning / Pending / Attention |
| Error | `#D64545` | Error / Failed / Critical |
| Info | `#315BFF` | Information / System notice |

Do not use semantic colors as decoration.

---

# 7. Color Token Definition

The frontend must expose the brand system through design tokens.

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

# 8. Recommended UI Color Hierarchy

Default enterprise application:

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

Recommended visual proportion:

```text
Neutral / White     70–85%
Black / Dark        10–20%
Blue                 5–10%
Cyan                 <5%
Semantic Colors      As required
```

The UI must not become predominantly blue or cyan.

---

# 9. Logo Rules

## 9.1 Logo Color

The default Lyness logo is:

```text
#0B0D10
```

on:

```text
#FFFFFF
```

The logo should remain monochrome.

## 9.2 Logo Must Not

The logo must not:

- Use gradients
- Use glow
- Use shadows
- Use 3D effects
- Use metallic effects
- Use textures
- Use multiple colors
- Be placed inside unnecessary decorative shapes
- Be combined with AI robot imagery
- Be combined with circuit-board patterns

## 9.3 Logo Concept

The logo should communicate:

- Direction
- Control
- Orchestration
- Technology
- Simplicity

It should not communicate:

- Robot
- Brain
- Whale
- Fish
- Circuit board
- Sci-fi
- Cryptocurrency
- Gaming

---

# 10. Typography

## 10.1 General Principle

Typography should be:

- Geometric
- Modern
- Sans-serif
- Clean
- Highly readable
- Neutral
- Enterprise-oriented

Avoid decorative typography.

## 10.2 Recommended Font Stack

Web:

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

Chinese:

```css
font-family:
  Inter,
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans SC",
  sans-serif;
```

## 10.3 Wordmark

Official wordmark:

```text
lyness
```

Rules:

- lowercase only
- exact spelling: `l-y-n-e-s-s`
- single line
- no icon
- no tagline
- no additional text

---

# 11. Layout Principles

Lyness interfaces must feel:

> Structured, spacious and controlled.

Avoid dense layouts unless the product scenario requires high information density.

Preferred hierarchy:

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

Use an 8px spacing system.

Recommended spacing:

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

Prefer multiples of 8px.

---

# 12. Border Radius

Lyness uses restrained rounding.

Recommended:

```text
Small:   6px
Medium:  8px
Large:   12px
Card:    12px
Modal:   16px
```

Avoid `9999px` for large containers.

Pill shapes should only be used for:

- Tags
- Status
- Small controls
- Filters

---

# 13. Borders

Default border:

```css
border: 1px solid #E5EAF2;
```

Borders should be subtle.

Avoid:

- thick borders
- decorative borders
- glowing borders
- colorful borders without semantic meaning

---

# 14. Shadows

Lyness uses very subtle shadows.

Recommended:

```css
box-shadow:
  0 1px 2px rgba(11, 13, 16, 0.04);
```

For elevated components:

```css
box-shadow:
  0 8px 24px rgba(11, 13, 16, 0.08);
```

Do not use:

- neon glow
- strong black shadows
- colored glow
- futuristic floating effects

---

# 15. Button System

## Primary

```text
Background: #315BFF
Text:       #FFFFFF
```

Hover / pressed:

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

Only for destructive actions.

Do not use red as a decorative brand color.

---

# 16. Agent Visual Language

Lyness is an Agent orchestration platform.

Use the following semantic system:

| Object | Color | Meaning |
|---|---|---|
| Platform | `#0B0D10` | Lyness platform / orchestration layer |
| Agent | `#315BFF` | Active AI Agent |
| Running Agent | `#22B8D6` | AI execution / runtime |
| Human | `#667085` | Human participant / approval |
| Tool | `#7C5CFC` | External tool or service |
| Knowledge | `#0EA5A8` | Knowledge base / documents / retrieval |
| Success | `#16A36A` | Successful execution |
| Error | `#D64545` | Failed execution |

`#7C5CFC` and `#0EA5A8` are semantic UI colors only and are not core brand colors.

---

# 17. Agent Workflow Visualization

A typical Lyness workflow should communicate:

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

Visual rules:

- Agent nodes: Lyness Blue
- Running state: Lyness Cyan
- Connections: Gray / Blue
- Knowledge: semantic teal
- Tools: semantic purple
- Human approval: Gray
- Success: Green
- Error: Red

Avoid excessive colors.

---

# 18. AI Runtime Animation

Animations should communicate:

> Activity, flow and execution.

Recommended:

- subtle pulse
- flowing connection
- progress indicator
- node activation
- status transition

Avoid:

- particle explosions
- neon glow
- excessive particles
- spinning 3D objects
- flashy effects

Animation should be functional, not decorative.

Recommended duration:

```text
Fast:   120–180ms
Normal: 200–300ms
Slow:   400–600ms
```

---

# 19. Dark Mode

Dark mode is supported.

Base:

```text
Background: #0B0D10
Surface:    #11151C
Surface 2:  #171C25
```

Text:

```text
Primary:   #FFFFFF
Secondary: #AAB2C0
```

Brand:

```text
Primary Blue: #315BFF
AI Cyan:      #22B8D6
```

Dark mode must not introduce:

- neon purple
- glowing gradients
- excessive cyan
- cyberpunk styling

Dark mode should remain:

> Enterprise + Technical + Restrained.

---

# 20. Web Design Rules

Lyness website should use:

```text
White
+
Black
+
Lyness Blue
+
Small amount of Cyan
```

Hero sections should generally be:

```text
White background
Black typography
Blue CTA
Minimal AI visualization
```

Recommended structure:

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

Avoid:

- giant glowing AI brains
- humanoid robots
- futuristic cities
- excessive gradients
- generic neural-network imagery
- stock photos of people staring at holograms

---

# 21. App Design Rules

Default application background:

```text
#F5F7FA
```

Cards:

```text
#FFFFFF
```

Navigation:

```text
#0B0D10
```

Primary action:

```text
#315BFF
```

AI activity:

```text
#22B8D6
```

Priorities:

1. Information hierarchy
2. Workflow clarity
3. Action clarity
4. Status visibility
5. Enterprise readability

Visual decoration is secondary.

---

# 22. Dashboard Design

Dashboards must prioritize:

```text
Data
Hierarchy
Comparison
Status
Action
```

Preferred chart sequence:

```text
#315BFF
#22B8D6
#1937B8
#667085
```

Do not automatically generate rainbow charts.

Avoid multiple colors unless each color has a clear semantic meaning.

---

# 23. AI Generated Visual / IP Guidelines

Any AI-generated Lyness IP, illustration, mascot or marketing visual must follow these principles.

## Core Visual Concept

The IP should represent:

> **An intelligent orchestration entity that guides, coordinates and controls multiple agents.**

Preferred concepts:

- Navigator
- Guide
- Conductor
- Coordinator
- Controller
- Abstract intelligent entity
- Geometric companion
- Directional symbol

Avoid literal humanoid robots.

---

# 24. IP Visual Style

Preferred:

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

Preferred materials:

- matte
- smooth
- clean
- flat vector
- minimal 3D when necessary

Avoid:

- metallic sci-fi
- chrome
- glossy plastic
- cyberpunk
- excessive holograms
- complex mechanical parts

---

# 25. IP Color Rules

Primary:

```text
#0B0D10
#315BFF
#22B8D6
#FFFFFF
```

Secondary:

```text
#1937B8
#F5F7FA
#E5EAF2
```

The IP should primarily use:

```text
Black + Blue + White
```

Cyan may be used for:

```text
AI / energy / activity / intelligence
```

Cyan should remain visually subordinate to Blue.

---

# 26. AI Image Generation Prompt Template

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

# 27. IP Generation Negative Prompt

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

# 28. IP Character Direction

If an IP character is created, it should feel like:

> A calm intelligent coordinator.

Preferred personality:

- calm
- intelligent
- reliable
- confident
- focused
- helpful
- precise

Avoid:

- childish
- overly cute
- exaggerated emotions
- aggressive
- superhero
- comic-book styling

---

# 29. Marketing Illustration Direction

Marketing illustrations should visualize concepts such as:

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

Recommended metaphor:

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

The Lyness platform should be visually represented as the orchestration center.

---

# 30. Iconography

Icons should be:

- simple
- geometric
- consistent
- 2D
- line or solid style
- rounded where appropriate

Recommended stroke:

```text
1.5px – 2px
```

Avoid:

- highly detailed icons
- 3D icons
- colorful icon packs
- inconsistent icon styles

---

# 31. Gradient Rules

Gradients are **not part of the core Lyness identity**.

Default:

> Do not use gradients.

If a marketing visual genuinely requires a gradient, use only:

```text
#315BFF → #22B8D6
```

Example:

```css
background:
  linear-gradient(
    135deg,
    #315BFF 0%,
    #22B8D6 100%
  );
```

Gradients must not be used:

- on the logo
- on standard buttons
- on primary typography
- throughout the entire UI
- as a substitute for brand structure

---

# 32. Forbidden Visual Language

The following styles are explicitly **not Lyness**:

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

# 33. Glassmorphism

Glassmorphism is not the default Lyness style.

Avoid:

- heavy blur
- transparent cards everywhere
- bright glow
- glass panels stacked on glass panels

If used in a marketing hero:

- use sparingly
- maintain strong contrast
- maintain enterprise readability
- never replace primary UI structure

---

# 34. AI Coding Agent Rules

When an AI coding agent creates or modifies Lyness UI, it must follow this document.

## MUST

The coding agent MUST:

- Use Lyness design tokens
- Use the defined color system
- Preserve brand hierarchy
- Use semantic colors appropriately
- Maintain sufficient contrast
- Prefer existing components over inconsistent new styles
- Reuse spacing and radius tokens
- Keep UI visually restrained
- Keep Agent/Workflow states semantically consistent

## SHOULD

The coding agent SHOULD:

- Reuse existing design tokens
- Reuse existing components
- Prefer CSS variables
- Prefer 8px spacing
- Prefer simple layouts
- Minimize unnecessary visual effects
- Keep animations functional
- Keep pages visually spacious

## MUST NOT

The coding agent MUST NOT:

- Introduce arbitrary brand colors
- Replace Lyness Blue with purple
- Create rainbow gradients
- Add neon effects
- Add unnecessary glow
- Add robot imagery by default
- Add AI brain imagery
- Use gradients on the logo
- Change the logo color without explicit instruction
- Create inconsistent button styles
- Create excessive rounded cards
- Add decorative UI without a functional purpose

---

# 35. AI Design Agent Rules

When an AI design agent generates visual concepts for Lyness, it must first identify:

```text
1. What is being represented?
2. What is its semantic role?
3. Which brand color represents it?
4. Is the visual functional or decorative?
5. Does it preserve Quiet Intelligence?
```

Reject a design if:

```text
Visual complexity > Information value
```

or:

```text
Decoration > Product meaning
```

---

# 36. Brand Decision Framework

When there is uncertainty about a visual decision, prioritize:

```text
1. Brand consistency
2. Product meaning
3. Usability
4. Information hierarchy
5. Accessibility
6. Visual aesthetics
7. Decorative effects
```

Never prioritize decoration over usability.

---

# 37. TypeScript Design Tokens

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

# 38. Tailwind Mapping

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

Example:

```html
<button class="bg-lyness-blue text-white">
  Create Agent
</button>
```

---

# 39. Component Naming

Components should use semantic names.

Recommended:

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

Avoid vague names:

```text
BlueBox
CoolCard
AICard2
MagicButton
FancyPanel
```

---

# 40. Project-Level Agent Integration

Recommended project structure:

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

Recommended `AGENTS.md` rule:

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

# 41. Quick Reference

## Brand

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

## Core Colors

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

## Neutral

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

## Semantic

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

# 42. One-Line Brand Rule

> **Lyness should look intelligent, controlled and trustworthy — never loud, flashy or gimmicky.**

> **Quiet Intelligence. Powerful Orchestration.**
