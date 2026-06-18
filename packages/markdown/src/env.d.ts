declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// 侧效样式导入（如 katex/dist/katex.min.css），运行时由 Vite 处理
declare module '*.css'
