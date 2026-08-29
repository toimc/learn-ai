import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    // entryRoot/exclude 与 core 同款：测试迁出 src 后不补会导致 dts 落到 dist/src/**，types 入口断裂
    vue(),
    dts({ rollupTypes: true, entryRoot: 'src', exclude: ['__tests__'] }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['vue', '@toimc/core'],
      output: {
        globals: {
          vue: 'Vue',
          '@toimc/core': 'AiChatCore',
        },
      },
    },
  },
})
