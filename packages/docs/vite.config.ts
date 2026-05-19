import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

const root = resolve(__dirname)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ai-chat/core': resolve(root, '../core/src/index.ts'),
      '@ai-chat/vue': resolve(root, '../vue/src/index.ts'),
      '@ai-chat/markdown': resolve(root, '../markdown/src/index.ts'),
    },
  },
})
