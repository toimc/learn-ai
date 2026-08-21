# 样式隔离规则

> 适用范围:`packages/vue`、`packages/markdown` 的全部样式代码(`<style>` 块、`styles/*.css`、CSS 变量)。组件库会被嵌入任意宿主应用,任何一条"泄漏"规则都会污染宿主。规格见 `docs/superpowers/spec/04-样式隔离与样式Rules-20260815.md`。

## 1. 命名纪律

所有类选择器必须以 `.ai-chat-` 前缀开头(BEM 可用 `__`/`--` 扩展)。工具类(如 `.ai-chat-scrollbar`)同样遵守。

```css
/* 正例 */
.ai-chat-window__body { padding: 8px; }
/* 反例：无前缀类会与宿主或第三方库撞名 */
.window-body { padding: 8px; }
```

## 2. @layer 铁律

所有库样式必须写进 `ai-chat-*` 层。层顺序只在 `packages/vue/src/styles/tokens.css` 顶部声明一次：

```css
@layer ai-chat-base, ai-chat-tokens, ai-chat-components, ai-chat-animations;
```

- 归层：重置 → `ai-chat-base`；令牌 → `ai-chat-tokens`；组件样式 → `ai-chat-components`；动画 keyframes → `ai-chat-animations`；新增层必须先在 tokens.css 顶部按依赖顺序补声明
- **严禁写未分层规则**：未分层规则优先级高于所有 @layer，比宿主样式还强，等于反向污染宿主，宿主只能用 `!important` 压制
- 例外：`scoped` 的 `<style>` 块可不包层——`data-v-xxx` 属性选择器天然只命中本组件，不会泄漏

```css
/* 正例 */
@layer ai-chat-components {
  .ai-chat-button { border-radius: var(--ai-chat-radius-md); }
}

/* 反例：未分层，优先级压过宿主一切样式 */
.ai-chat-button { border-radius: var(--ai-chat-radius-md); }
```

## 3. 禁入区

`:root`、`*`、裸 `body`/`html`、裸元素选择器(`div`/`p`/`a` 等)**只允许出现在 `packages/vue/src/styles/tokens.css` 的既定位置**(令牌定义与 `.ai-chat-window` 子树 box-sizing)。组件内一律禁止。

- 禁止 `!important`（宿主靠层顺序就能覆盖我们），禁止组件内写 `@font-face`（全局字体下载是宿主决策，见第 4 条）

```css
/* 正例：作用域限定在库自身子树 */
@layer ai-chat-base {
  .ai-chat-window, .ai-chat-window *, .ai-chat-window *::before, .ai-chat-window *::after {
    box-sizing: border-box;
  }
}

/* 反例：全局 reset 直接改写宿主每个元素 */
* { box-sizing: border-box; }
```

## 4. 第三方 CSS

引入第三方样式必须走包的**可选子路径导出**(如 `@toimc/markdown/katex.css`)，由宿主显式 import。禁止在库代码中模块级 `import 'xxx.css'` 隐式注入——宿主无法 opt-out，也无法 tree-shake。

```ts
// 正例：宿主按需引入(文档写明用法)
import '@toimc/markdown/katex.css'

// 反例：包源码强制注入，所有使用方被动背上 ~25KB CSS + 字体下载
import 'katex/dist/katex.min.css'
```

## 5. 主题联动

- 颜色/圆角/动效一律引用 `--ai-chat-*` 变量，禁止硬编码色值
- `data-theme` 属性只能通过 `useTheme` 的 `target` 选项写入：`'html'`(默认，写宿主根)或 `'component'`(写组件根子树)；组件不得读宿主 `<html>` 属性做样式判断，也不得自己 `setAttribute('data-theme', ...)`
- `@layer` 与 `:root` 令牌的关系：令牌在 `ai-chat-tokens` 层内定义，宿主未分层的 `:root { --ai-chat-*: ... }` 天然覆盖它——宿主覆盖组件样式**无需 `!important`**，一行普通 CSS 即可

```css
/* 正例：宿主覆盖主色，未分层 → 直接生效 */
:root { --ai-chat-color-accent-500: #8b5cf6; }

/* 反例：库里硬编码色值 */
.ai-chat-button { background: #6366f1; }
```

## 6. z-index

组件内部局部层叠(卡片 hover 遮罩、流式光标等)用小值，**≤ 10** 自由使用；未来 Teleport 弹层(消息预览、抽屉)脱离文档流，必须先在 tokens.css 定义 z-index 令牌(如 `--ai-chat-z-popup`)再引用，禁止裸写 `z-index: 9999` 与宿主弹层打架。

```css
/* 正例 */
.ai-chat-msg-actions { z-index: 2; }
/* 反例：裸写大值会与宿主弹层打架 */
.ai-chat-preview { z-index: 9999; }
```

## 7. 新增样式提交前自查清单

- [ ] **前缀**：每个类选择器都有 `.ai-chat-` 前缀？
- [ ] **层**：非 scoped 样式都包进了 `ai-chat-*` 层？没引入未分层规则？
- [ ] **禁入区**：没碰 `:root`/`*`/裸元素选择器？没有 `!important`？没有 `@font-face`？
- [ ] **主题变量**：颜色/尺寸全部走 `--ai-chat-*` 变量，无硬编码？
- [ ] **作用域**：新增规则命中范围只落在 `.ai-chat-*` 子树内？第三方 CSS 走可选子路径导出？
