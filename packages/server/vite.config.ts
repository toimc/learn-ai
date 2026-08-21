import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ rollupTypes: true, exclude: ['src/**/*.test.ts'] })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      // hono 与 workspace 依赖保持 external，由消费侧安装
      external: ['hono', /^@toimc\//],
    },
  },
})
