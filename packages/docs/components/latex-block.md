# LatexBlock

LaTeX 公式显示组件。当前版本以斜体衬线字体渲染公式文本。

> KaTeX 样式为可选引入：渲染公式排版需手动 `import '@toimc/markdown/katex.css'`（详见[安装指南](/guide/installation)），组件本身不注入任何全局样式或字体。

## 代码演示

<script setup lang="ts">
import { LatexBlock } from '@toimc/markdown'

const inlineFormula = 'E = mc^2'
const blockFormula = '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}'
</script>

公式语法错误时整条回退为原始文本展示，不会让页面渲染崩溃。

### 行内公式

默认形态（`display: false`）：随正文基线排列，不独占一行。Best for：段落中夹带的变量、简短等式。

<DemoContainer>
  <p style="margin: 0; line-height: 2">
    质能方程 <LatexBlock :formula="inlineFormula" />
    刻画了静止质量与能量的等价关系，是相对论最著名的推论。
  </p>
</DemoContainer>

### 块级公式

`display: true`：独立成行、居中、字号略放大。Best for：推导步骤、积分 / 求和等长公式。

<DemoContainer>
  <LatexBlock :formula="blockFormula" :display="true" />
</DemoContainer>

## 基础用法

```vue
<script setup lang="ts">
import { LatexBlock } from '@toimc/markdown'
</script>

<template>
  <!-- 行内公式：随文本排列 -->
  <p>质能方程 <LatexBlock formula="E = mc^2" /></p>
  <!-- 块级公式：居中独占一行 -->
  <LatexBlock
    formula="\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}"
    :display="true"
  />
</template>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| formula | `string` | — | LaTeX 公式文本（必填） |
| display | `boolean` | `false` | 是否以块级居中方式显示 |
