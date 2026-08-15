---
name: i18n
description: ai-chat-ui 组件库国际化规范。创建或修改组件、新增 UI 文案、新增语言时必须使用，确保文案进字典、双语同步、类型约束。
---

# ai-chat-ui i18n 规范

适用：`packages/vue`、`packages/markdown` 的组件与 `packages/playground` 的 UI 文案。

## 五条纪律

1. **UI 文案禁止硬编码**：所有用户可见文本（含 placeholder、title、aria-label、按钮/空态/错误文案）必须进字典 `packages/vue/src/locales/{zh-CN,en-US}.ts`，组件内经 `const { t } = aiChatI18n.global` 使用。playground 文案进 `packages/playground/src/locales/index.ts` 的 `pg` 命名空间。
2. **双语同次提交**：`zh-CN.ts` 与 `en-US.ts` 必须同时更新；`en-US.ts` 保持 `satisfies MessageSchema`（从 `./zh-CN` import type），缺 key / 写错 key 编译期报错。
3. **key 命名**：camelCase；namespace = 组件域（现有：shared / promptInput / conversation / message / toolCall / attachments / comparison / inputArea / pg）。新组件建自己的 namespace，通用文案进 shared。带变量的文案用 vue-i18n 插值 `t('xx.confirmRemove', { title })`，禁止字符串拼接。
4. **props 优先、t() 兜底**：组件文本 props 不写死默认值，用 `computed(() => props.title ?? t('xx.yy'))`；宿主传了 props 就优先。禁止 `withDefaults` 里给文本 props 中文默认值。
5. **文档同步门禁**：新增/修改组件 API 后同步 VitePress 对应页面（`packages/docs/components/*.md`）。

## 语言切换

- 组件库实例：`aiChatI18n`（`packages/vue/src/locales/index.ts`，模块级单例，宿主零配置）
- 切换：`setAiChatLocale('en-US')`（写 locale + `<html lang>` + localStorage）
- UI 切换组件：`<LanguageToggle />`（props：locales / modelValue）
- 宿主注入自定义语言：`aiChatI18n.global.setLocaleMessage(locale, messages)` 后 `setAiChatLocale(locale)`；注意 setLocaleMessage 是整体替换，合并时带上 `getLocaleMessage(locale)` 原有内容。

## checklist（提交前）

- [ ] 新增文案两份字典都有？
- [ ] en-US satisfies 编译通过（`corepack pnpm type-check`）？
- [ ] 没有新的硬编码 UI 文案？（grep 中文字符串 / 常见英文 label 于 .vue template）
- [ ] 文案 props 未写死默认值？
