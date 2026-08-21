import { inject, provide, type Component, type InjectionKey } from 'vue'

export const markdownRendererKey: InjectionKey<Component> = Symbol(
  'ai-chat-markdown-renderer',
)

/** 用户在应用入口（或 VitePress enhanceApp 的 app.provide）注入 MarkdownRenderer，MessageContent 即自动启用 */
export function provideMarkdownRenderer(renderer: Component) {
  provide(markdownRendererKey, renderer)
}

export function useMarkdownRenderer(): Component | null {
  return inject(markdownRendererKey, null)
}
