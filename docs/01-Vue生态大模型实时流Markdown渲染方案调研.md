# Vue 生态大模型实时流 Markdown 渲染方案调研

> 调研日期：2026-06-18
> 调研对象：`@toimc/markdown` 包从「正则 MVP」升级到「面向大模型实时流会话」的成熟 Markdown 渲染方案
> 目标特性：代码高亮、数学公式、图表、高性能、实时流式渲染、Vue 3 集成

---

## TL;DR（结论先行）

针对 ai-chat-ui「后端无关 + Vue 3 + 大模型实时流会话」的定位，**推荐自研轻量封装**而非套用重型编辑器，技术栈选型如下：

| 维度 | 推荐方案 | 理由 |
|------|----------|------|
| 解析引擎 | **markdown-it** | 插件生态最全（公式/高亮/图表一站式）、CommonMark 规范、流式友好、VitePress 与 md-editor-v3 同款 |
| 代码高亮 | **Shiki**（流式期间降级 highlight.js 或 `@shikijs/stream`） | VSCode 同款 TextMate 语法、颜值最高、官方有专门的 Stream 包应对 LLM 输出 |
| 数学公式 | **KaTeX** | 同步渲染、零依赖、比 MathJax 快一个量级、流式重渲不卡 |
| 图表 | **Mermaid** | 文本生成图表的事实标准、LLM 输出友好；沙箱 iframe 防注入 |
| Vue 封装 | **自研 `<MarkdownRenderer>`**（项目已有骨架） | 完全可控、体积可控、流式可定制、与现有 ChatAdapter 流式架构无缝 |
| XSS 防护 | **DOMPurify** | LLM 输出不可信，`v-html` 必须消毒 |

**核心架构**：`markdown-it` 解析 + Shiki/KaTeX/Mermaid 各司其职 + 节流容错的流式渲染层。详见第 8、9 章。

---

## 1. 调研背景：ai-chat-ui 现状与目标

### 现状（`packages/markdown/src/MarkdownRenderer.vue`）

当前是**手写正则的 MVP**（`simpleMarkdown` 函数），能力非常有限：

- 仅支持：代码块（**纯文本无高亮**）、行内代码、粗体、斜体、h1/h2/h3、换行
- 用 Unicode 私用区占位符解决「换行穿透 `<pre>`」的已知坑（见 commit `47e2db7`）
- **不支持**：代码高亮、数学公式、图表、表格、列表、链接、引用等

```ts
// 现状：手写正则，无法满足大模型会话需求
function simpleMarkdown(text: string): string {
  // ... escapeHtml → 正则替换粗体/标题/代码 → \n→<br>
}
```

### 目标

| 需求 | 说明 |
|------|------|
| 代码高亮 | LLM 频繁输出多语言代码块，需语法高亮 |
| 数学公式 | 支持 `$...$` 行内、`$$...$$` 块级 LaTeX |
| 图表 | 支持 Mermaid 流程图/时序图等 |
| 性能 | 长对话、大段输出不卡顿 |
| 实时流式 | **核心难点**——逐 token 到达时增量渲染、无闪烁 |
| Vue 3 | 与 `@toimc/vue` 组件、ChatAdapter 流式架构无缝集成 |

---

## 2. Markdown 解析引擎对比

主流三方：**markdown-it** / **marked** / **remark（unified 生态）**。数据来自 npm-compare（2026 年）：

| 引擎 | 月下载 | GitHub Star | 包体积 | 定位 |
|------|--------|-------------|--------|------|
| **marked** | 4034 万 | 36.7k | 449 kB | 最快最轻，API 极简 |
| **markdown-it** | 2226 万 | 21.4k | 768 kB | 插件生态最全，可逐 token 扩展 |
| **remark**（unified） | 386 万 | 8.8k | 15.7 kB（核心） | AST 可组合，React 系标配 |
| showdown | — | 14.8k | 801 kB | 老牌，更新缓慢，不推荐 |

### markdown-it（✅ 推荐）

- 遵循 **CommonMark 规范** + 语法糖（URL autolinking、typographer）
- **插件生态最丰富**（`markdown-it-plugin` keyword），公式/高亮/图表都有成熟插件
- 可「添加规则、替换规则」，逐 token 控制渲染
- 高速、默认安全
- **流式友好**：同步纯函数 `md.render(text)`，无副作用，便于节流重渲
- VitePress、md-editor-v3 均基于它——Vue 生态验证充分

### marked

- 速度最快、体积最小、API 最简单
- 但**插件扩展性弱**于 markdown-it，公式/图表需自己接
- 适合「只要快、功能简单」场景

### remark / unified

- 基于 AST（Markdown → mdast → hast → html），最现代化、最可组合
- 生态：`remark-gfm`、`remark-math`、`rehype-katex`、`rehype-highlight`/shiki
- **react-markdown 的底层**，React 生态标配
- 缺点：AST 解析比 markdown-it **慢**、整体体积大、**Vue 生态现成封装少**、流式重渲成本更高

### 结论

> **ai-chat-ui 选 markdown-it**：插件一站解决公式/高亮/图表，同步纯函数利于流式节流，Vue 生态有 md-editor-v3 这样的成熟参考实现。

来源：[markdown-it](https://github.com/markdown-it/markdown-it)、[npm-compare 对比](https://npm-compare.com/markdown-it,marked,remark,showdown)

---

## 3. 代码高亮方案对比

| 方案 | 渲染质量 | 性能/体积 | 流式适配 | 主题 |
|------|----------|-----------|----------|------|
| **Shiki** | ⭐⭐⭐⭐⭐（VSCode 同款） | 重（grammar 按需 bundle） | ✅ 官方 `@shikijs/stream` | 与 VSCode 一致，Dual Themes |
| **highlight.js** | ⭐⭐⭐ | 最轻最快、零初始化 | ✅ 最简单 | 主题一般 |
| **Prism** | ⭐⭐⭐⭐ | 轻、按语言加载 | ✅ 良好 | 组件化 |

### Shiki（✅ 推荐主方案）

- **VSCode 同款 TextMate 语法**（Oniguruma / JS-Regex 双引擎），颜色最准最美
- 主题丰富，`github-light` / `vitesse-dark` 等与编辑器一致
- 纯函数 `codeToHtml(code, { lang, theme })`，类型友好
- **关键能力**（来自官网导航）：
  - **`@shikijs/stream`**：「Streaming colorization for shiki. Useful for highlighting text streams like **LLM outputs**.」——**专为流式场景设计**
  - **Best Performance Practices** 指南：highlighter 复用、按需 bundle、fine-grained `codeToTokens`
  - **Dual Themes**：明暗双主题同时输出，CSS 切换**无需重新渲染**（配合项目暗色模式 `useTheme` 完美）
  - **markdown-it 集成包**：`@shikijs/markdown-it`
- 缺点：首次实例化 highlighter 较慢（需 async 初始化），需 lazy + 按需 grammar

### highlight.js（✅ 备选 / 流式降级方案）

- 最轻量、最快、**零初始化成本**、支持自动语言检测
- API 简单：`hljs.highlightElement(el)` 或 `hljs.highlight(code, {language}).value`
- **最适合流式过程中的「临时高亮」**：避免 Shiki 首次加载延迟

### Prism

- 老牌、轻量、`prismjs/components` 按语言加载
- 被 react-syntax-highlighter 等使用，能力介于两者之间

### 流式场景推荐策略：两段式

```
流式进行中(streaming=true):  highlight.js 快速高亮（或纯文本）—— 避免卡顿
流式结束(streaming=false):   Shiki 重新高亮 —— 颜值最优
```

或直接采用官方 **`@shikijs/stream`** 逐 token 流式着色。

来源：[Shiki 官网](https://shiki.style/)、[@shikijs/stream](https://shiki.style/packages/stream)、[Best Performance](https://shiki.style/guide/best-performance)

---

## 4. 数学公式方案对比

| 方案 | 速度 | 体积 | 渲染方式 | LaTeX 覆盖 |
|------|------|------|----------|-----------|
| **KaTeX**（✅ 推荐） | 极快（比 MathJax 快约一个量级） | 小（零依赖） | **同步** | 主流公式 99% |
| **MathJax** | 慢 | 大（~1MB） | 异步 | 完整 LaTeX + 宏包 |

### KaTeX（✅ 强烈推荐）

来自官方 README 的核心特性：

- **Fast**：**同步渲染**，不需要页面 reflow（对比 MathJax 速度测试 [intmath.com/cg5](https://www.intmath.com/cg5/katex-mathjax-comparison.php)）
- **Print quality**：基于 Donald Knuth 的 TeX 排版（数学排版黄金标准）
- **Self contained**：零依赖
- **Server side rendering**：SSR 输出一致

**对 ai-chat-ui 的意义**：KaTeX 同步渲染 = 流式重渲不卡顿，这是流式场景选择 KaTeX 而非 MathJax 的决定性理由。LLM 输出的公式（积分、矩阵、求和等）KaTeX 99% 覆盖，无需 MathJax 的冷门宏包。

**markdown-it 集成**：`@traptitech/markdown-it-katex` 或 `markdown-it-texmath`（后者配置更灵活）。

### MathJax

仅在需要完整 LaTeX（AMS、自定义宏）时才考虑，但慢、异步、流式重渲卡顿明显——**不推荐用于实时流场景**。

来源：[KaTeX](https://github.com/KaTeX/KaTeX)

---

## 5. 图表方案：Mermaid

### Mermaid（✅ 事实标准，唯一推荐）

- **基于 Markdown 风格文本生成图表**，LLM 输出极其友好（大模型天然擅长生成 Mermaid 语法）
- 支持 **11 类图表**：Flowchart、Sequence、Gantt、Class、State、Pie、Git Graph、User Journey、C4、ER、Bar chart
- 异步渲染：`mermaid.render(id, text)` 返回 `Promise<{ svg }>`
- 体积大（gzip ~280kB+），**必须动态 `import()`** 按需加载

### ⚠️ LLM 场景的关键安全问题（官方明确强调）

Mermaid 官方 README「Security and safe diagrams」指出：

> 图表含大量 HTML 字符，**标准消毒会破坏图表**；用户内容可能内嵌恶意脚本。为此提供 **sandboxed iframe 渲染**——在沙箱 iframe 中渲染，阻止代码中的 JS 执行。

对 ai-chat-ui：LLM 输出**不可信**，Mermaid 渲染**必须**用沙箱 iframe 或严格的渲染隔离，防止图表语法注入 XSS。

### 流式处理

- ```mermaid 代码块**未闭合时不渲染**（避免语法不完整报错闪烁）
- 检测到闭合的 ``` 后，`nextTick` 触发异步 `mermaid.render`，渲染中显示 loading 占位

来源：[Mermaid](https://github.com/mermaid-js/mermaid)

---

## 6. Vue 生态现成封装方案对比

| 方案 | 技术栈 | 完整度 | 流式 | 体积 | 适合 ai-chat-ui |
|------|--------|--------|------|------|-----------------|
| **md-editor-v3**（imzbf） | Vue3 + jsx + TS | ⭐⭐⭐⭐⭐ | 需改造 | 偏大 | ⚠️ 可用其 MdPreview |
| **vue-markdown**（shunnNet） | Vue3 + unified | ⭐⭐⭐ | 需自配 | 中 | 备选 |
| **自研封装**（推荐） | markdown-it + Shiki + KaTeX + Mermaid | 按需 | ✅ 完全可控 | 最优 | ✅ |

### md-editor-v3（Vue3 最完整的现成方案）

来自官方 README 的能力清单：

- 工具栏、明暗主题、快捷键、prettier 美化、多语言、图片上传
- **纯预览模式**（`MdPreview`：无编辑器、无事件监听、仅渲染内容）——**对聊天场景很关键**
- 6 套预览主题：default / vuepress / github / cyanosis / mk-cute / smart-blue
- **mermaid（≥1.8.0）、katex 数学公式（≥1.9.0）**
- **按需导入（≥4.0.0）**
- React 同系列：md-editor-rt

**评价**：功能最全、开箱即用，**但本质是编辑器**，聊天场景若只用其 `MdPreview`，主题/样式耦合较多、深度定制需 fork；流式渲染需自行改造。适合「想快速验证、不在意体积和定制」。

### vue-markdown（shunnNet，基于 unified）

基于 unified 生态，声明式、现代、轻量，但插件需自行配置，公式/图表要自己接 rehype/remark 插件。

### 自研封装（✅ 推荐给 ai-chat-ui）

项目**已有骨架**（`MarkdownRenderer.vue` / `CodeBlock.vue` / `LatexBlock.vue`），自研有四大优势：

1. **完全可控**：解析→高亮→消毒→渲染全链路可定制
2. **体积可控**：Shiki grammar / KaTeX CSS / Mermaid 全部按需动态加载
3. **流式可定制**：节流、容错截断、增量渲染深度适配 ChatAdapter 的 `for await` 流
4. **与现有架构无缝**：`@toimc/vue` 的 `StreamText` 流式光标、`useTheme` 暗色、CSS Variables 主题（`--ai-chat-*`）天然对接

来源：[md-editor-v3](https://github.com/imzbf/md-editor-v3)、[vue-markdown](https://github.com/shunnNet/vue-markdown)

---

## 7. 选型决策总览

```
┌─────────────────────────────────────────────────────────────┐
│                    ai-chat-ui Markdown 栈                    │
├─────────────────────────────────────────────────────────────┤
│  解析引擎:  markdown-it  +  markdown-it-gfm (表格/任务列表)   │
│  代码高亮:  Shiki (@shikijs/markdown-it)  + Dual Themes      │
│  数学公式:  KaTeX  +  markdown-it-texmath                     │
│  图表:      Mermaid (动态 import, 沙箱渲染)                   │
│  XSS 防护:  DOMPurify                                         │
│  流式层:    节流 + 容错截断 + 增量 (自研 composable)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8.【核心】大模型实时流式渲染方案

这是 ai-chat-ui 的**核心难点**。逐 token 到达时，朴素地「每个 chunk 重新 `md.render(fullText)` + Shiki 高亮整篇」会带来严重问题。下面拆解四大难点与解法。

### 难点 1：未闭合的块级语法

流式过程中 ` ```js\nconst x = ` 代码围栏**未闭合**，直接整篇解析会出错，或把后续文本当代码内容。

**解法：容错预处理**。渲染前扫描 buffer，找到最后一个**未闭合**的 ```` ``` ```` / ` ```mermaid ` / `$$`，把不完整的尾部临时剔除或降级为纯文本：

```ts
/**
 * 从流式 buffer 中提取「安全可渲染」的 Markdown：
 * 截断到最后一个已闭合的块级边界，未闭合的围栏/公式留到下一帧。
 */
function extractCompleteMarkdown(buffer: string): string {
  // 1. 代码围栏：成对 ``` 算闭合，奇数个说明最后一个未闭合 → 截到倒数第二个 ```
  // 2. 块级公式 $$：同理配对
  // 3. 行内公式/其它：保留
  const fenceMatches = buffer.match(/```/g)
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    const lastFence = buffer.lastIndexOf('```')
    buffer = buffer.slice(0, lastFence) // 丢弃未闭合代码块
  }
  const dollarMatches = buffer.match(/\$\$/g)
  if (dollarMatches && dollarMatches.length % 2 === 1) {
    const lastDollar = buffer.lastIndexOf('$$')
    buffer = buffer.slice(0, lastDollar)
  }
  return buffer
}
```

### 难点 2：整体重渲染的闪烁与卡顿

每个 token 到达都全量重解析 + 高亮 → CPU 飙升、光标跳动、滚动位置丢失、代码块闪烁。

**解法组合**：

1. **节流渲染（最有效）**：用 `debounce(30~60ms)` 或 `requestAnimationFrame` 合并多个 chunk，避免每个 token 都重渲
2. **延迟高亮**：流式中代码块用 highlight.js 或纯文本，`streaming=false` 后再 Shiki 高亮（见第 3 章两段式）
3. **Vue 层优化**：用 `shallowRef` 持有渲染结果（避免深度响应式开销），key 用稳定的消息 id 而非内容 hash
4. **增量/分块渲染**（进阶）：按段落/块切分，已完成块缓存 HTML，只重渲最后变化的块

```ts
import { shallowRef, watch } from 'vue'

// 节流：rAF 合并多个流式 chunk
const renderedHtml = shallowRef('')
let rafId = 0
function scheduleRender(content: string) {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const safe = extractCompleteMarkdown(content)
    renderedHtml.value = DOMPurify.sanitize(md.render(safe))
  })
}
```

### 难点 3：滚动锚定

流式时内容持续增长，应自动滚动到底部；但用户手动上滚时应**停止**自动滚动。

**解法**：判断是否在底部 (`scrollHeight - scrollTop - clientHeight < threshold`)，配合 `IntersectionObserver` 检测用户滚动意图。

### 难点 4：异步渲染时序（Mermaid）

- KaTeX **同步**，流式中直接渲染
- Mermaid **异步**（`render` 返回 Promise），必须在 ```mermaid **闭合后**用 `nextTick` 触发，渲染中显示 loading 占位

### 流式渲染层架构

```
StreamText (现有流式光标组件)
  └─ MarkdownRenderer (props: content, streaming)
       ├─ preprocess:  extractCompleteMarkdown(content)   // 容错截断
       ├─ render:      md.render(safe)                    // rAF 节流后
       │    ├─ fence(mermaid) → <MermaidBlock>             // 异步, 闭合后渲染
       │    ├─ fence(code)    → <CodeBlock shiki|hljs>     // 流式 hljs, 结束 shiki
       │    └─ math ($$/$)    → KaTeX 同步
       └─ sanitize:    DOMPurify.clean(html)               // XSS 防护
```

---

## 9. ai-chat-ui 集成落地方案（分阶段）

项目已有 `packages/markdown` 骨架（MarkdownRenderer / CodeBlock / LatexBlock）。建议分 5 阶段渐进升级，每阶段独立可验证。

### Phase 1：替换解析内核（替换正则 MVP）

- 引入 `markdown-it` + `markdown-it-gfm`（表格/删除线/任务列表/链接自动化）
- 引入 `dompurify`，`v-html` 前必须消毒（LLM 输出不可信）
- `MarkdownRenderer.vue`：`simpleMarkdown` → `md.render(content)`
- **保留**现有 CSS Variables 主题（`--ai-chat-*`），不破坏样式一致性

```ts
// MarkdownRenderer.vue 核心改造
import MarkdownIt from 'markdown-it'
import markdownItGfm from 'markdown-it-gfm'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: false, linkify: true, breaks: false }).use(markdownItGfm)

const rendered = computed(() =>
  DOMPurify.sanitize(md.render(props.content))
)
```

### Phase 2：代码高亮（Shiki）

- 引入 `shiki`，按需 bundle 常用语言：js/ts/vue/python/json/bash/html/css/md
- `CodeBlock.vue`：流式期间纯文本或 `highlight.js`，`streaming=false` 后 Shiki 高亮（两段式）
- 接入 **Dual Themes**，配合 `useTheme` 暗色模式（CSS 切换不重渲）
- highlighter **lazy 初始化**（首次 async），避免阻塞首屏

### Phase 3：数学公式（KaTeX）

- 引入 `katex` + `markdown-it-texmath`（先 `$$` 块级后 `$` 行内的处理顺序，避免误伤）
- `LatexBlock.vue`：用 `katex.renderToString(expr, { throwOnError: false })`
- CSS **按需引入** `katex.min.css`

### Phase 4：图表（Mermaid）

- 引入 `mermaid`（**动态 `import()`**，按需加载，不进主 bundle）
- `CodeBlock` 识别 ```` ```mermaid ```` → 渲染为 `<MermaidBlock>`（异步 render + loading 占位 + 沙箱隔离）
- 未闭合的 mermaid 块不渲染（Phase 1 的容错截断已覆盖）

### Phase 5：流式优化（自研 composable）

- 新增 `useStreamingMarkdown` composable：节流（rAF）+ 容错截断 + 增量
- `StreamText` 集成流式光标
- 实现滚动锚定（底部自动跟随 + 用户上滚暂停）

### 体积控制（贯穿各阶段）

- Shiki grammar 按需 bundle，绝不全量
- KaTeX CSS 按需引入
- Mermaid 动态 `import()`，主包零成本
- `@toimc/markdown` 保持 **optional**（`@toimc/vue` 不强依赖，用户按需引入）——现状已是如此

---

## 10. 关键风险与避坑清单

| 风险 | 说明 | 对策 |
|------|------|------|
| **XSS 注入** | LLM 输出不可信，`v-html` 是攻击面 | `v-html` 前一律 `DOMPurify.sanitize` |
| **Mermaid 注入** | 图表含 HTML 字符，消毒会破坏图表 | 官方推荐**沙箱 iframe** 渲染 |
| **Shiki 首次加载慢** | highlighter 实例化较重 | lazy 初始化；可选 Web Worker；流式降级 hljs |
| **换行穿透 `<pre>`** | 项目已踩坑（commit `47e2db7`） | markdown-it 的 `breaks: false` + 围 fence 单独处理 |
| **流式闪烁/卡顿** | 全量重解析 + 重高亮 | rAF 节流 + 两段式高亮 + `shallowRef` |
| **未闭合块报错** | 流式中 ` ``` `/`$$` 未闭合 | `extractCompleteMarkdown` 容错截断 |
| **包体积膨胀** | Shiki/KaTeX/Mermaid 都不小 | 全部按需/动态 import，markdown 包保持 optional |
| **暗色模式高亮不变** | Shiki 主题切换需重渲 | 用 **Dual Themes**，CSS 切换不重渲 |

---

## 11. 参考来源

### 官方文档与仓库

- [markdown-it](https://github.com/markdown-it/markdown-it) — CommonMark 解析器，插件生态最全
- [marked](https://github.com/markedjs/marked) — 最快最轻的解析器
- [remark / unified](https://github.com/remarkjs/remark) — AST 可组合生态
- [npm-compare: marked vs markdown-it vs remark vs showdown](https://npm-compare.com/markdown-it,marked,remark,showdown) — 下载量/Star/体积对比数据（2026）
- [Shiki 官网](https://shiki.style/) — VSCode 同款语法高亮
- [@shikijs/stream](https://shiki.style/packages/stream) — **专为 LLM 流式输出设计的着色包**
- [Shiki Best Performance](https://shiki.style/guide/best-performance) — 性能最佳实践
- [KaTeX](https://github.com/KaTeX/KaTeX) — 同步、零依赖、快速的数学公式渲染
- [KaTeX vs MathJax 速度测试](https://www.intmath.com/cg5/katex-mathjax-comparison.php)
- [Mermaid](https://github.com/mermaid-js/mermaid) — 文本生成图表（11 类）

### Vue 生态封装

- [md-editor-v3](https://github.com/imzbf/md-editor-v3) — Vue3 最完整方案（mermaid + katex + 纯预览模式 + 按需导入）
- [vue-markdown](https://github.com/shunnNet/vue-markdown) — 基于 unified 的轻量封装
- [vue-markdown-render](https://www.npmjs.com/package/vue-markdown-render) — markdown-it 的轻量 TS 封装

### 本项目相关

- 现有骨架：`packages/markdown/src/{MarkdownRenderer,CodeBlock,LatexBlock}.vue`
- 已知坑修复：commit `47e2db7`（代码块换行穿透 `<pre>`）
- 架构约束：`@toimc/markdown` 为 optional 包，`@toimc/vue` 不强依赖

---

*调研完成于 2026-06-18。已分析 8 个权威源（GitHub README / 官网 / npm-compare）。临时研究数据已清理。*
