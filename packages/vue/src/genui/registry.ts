import type { Component } from 'vue'

/**
 * GenUI 组件注册表：type → Vue 组件 的封闭集合。
 *
 * 安全模型：`:is` 只能命中此处注册过的组件，未注册的 type 一律落到
 * GenUIRenderer 的 fallback。渲染的组件永远来自宿主的显式 import，
 * 不存在按字符串路径动态加载的通路。
 */
const registry = new Map<string, Component>()

/** 注册 GenUI 组件；空白 type 静默忽略（isUISchema 也不会放行空 type） */
export function registerGenuiComponent(
  type: string,
  component: Component,
): void {
  if (!type.trim()) return
  registry.set(type, component)
}

/** 按 type 解析已注册组件；未注册返回 undefined（渲染器走 fallback） */
export function resolveGenuiComponent(type: string): Component | undefined {
  return registry.get(type)
}

/** 注销（测试隔离 / 宿主卸载动态面板时使用） */
export function unregisterGenuiComponent(type: string): void {
  registry.delete(type)
}
