// docs vite 配置将 @scalar/api-reference-standalone alias 到
// @scalar/api-reference/dist/browser/standalone.esm.js（免 React 的 standalone 构建）
declare module '@scalar/api-reference-standalone' {
  export interface ScalarStandaloneConfig {
    url?: string
    content?: unknown
    darkMode?: boolean
    hideClientButton?: boolean
    [key: string]: unknown
  }
  export function createApiReference(
    element: HTMLElement | string,
    config?: ScalarStandaloneConfig,
  ): { mount: (target?: HTMLElement | string) => void }
}
