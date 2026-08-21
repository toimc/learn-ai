import { copyFileSync, cpSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

const require = createRequire(import.meta.url)
const pkgRoot = fileURLToPath(new URL('.', import.meta.url))

// FR-4（spec 04）：KaTeX CSS 拆为可选子路径产物 dist/katex.css（+ dist/fonts 字体），
// 宿主按需 `import '@toimc/markdown/katex.css'`，不再随入口隐式注入。
// 原样复制 katex 官方分发文件，保持字体懒加载与缓存语义。
function copyKatexCss(): Plugin {
  return {
    name: 'copy-katex-css',
    apply: 'build',
    closeBundle() {
      const katexCss = require.resolve('katex/dist/katex.min.css')
      const outDir = resolve(pkgRoot, 'dist')
      copyFileSync(katexCss, join(outDir, 'katex.css'))
      cpSync(join(dirname(katexCss), 'fonts'), join(outDir, 'fonts'), {
        recursive: true,
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), dts({ rollupTypes: true }), copyKatexCss()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['vue', '@toimc/core', '@toimc/vue'],
      output: {
        globals: {
          vue: 'Vue',
          '@toimc/core': 'AiChatCore',
          '@toimc/vue': 'AiChatVue',
        },
      },
    },
  },
})
