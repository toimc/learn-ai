# LatexBlock

LaTeX 公式显示组件。当前版本以斜体衬线字体渲染公式文本。

> KaTeX 样式为可选引入：渲染公式排版需手动 `import '@toimc/markdown/katex.css'`（详见[安装指南](/guide/installation)），组件本身不注入任何全局样式或字体。

## 基础用法

<DemoContainer>
  <div>
    <p>行内公式：</p>
    <LatexBlock formula="E = mc^2" />
    <p style="margin-top: 16px">块级公式：</p>
    <LatexBlock formula="\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}" :display="true" />
  </div>
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| formula | `string` | — | LaTeX 公式文本（必填） |
| display | `boolean` | `false` | 是否以块级居中方式显示 |
