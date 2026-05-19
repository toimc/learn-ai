import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue', '@ai-chat/core', '@ai-chat/vue'],
      output: {
        globals: {
          vue: 'Vue',
          '@ai-chat/core': 'AiChatCore',
          '@ai-chat/vue': 'AiChatVue',
        },
      },
    },
  },
})
