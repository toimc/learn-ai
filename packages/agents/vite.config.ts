import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ rollupTypes: true, exclude: ['src/**/*.test.ts'] })],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        mastra: 'src/mastra/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) =>
        format === 'es' ? `${name}.mjs` : `${name}.cjs`,
    },
    rollupOptions: {
      // workspace 依赖保持 external：类型来自 @toimc/core（类型即公共 API）
      external: [/^@toimc\//, /^@mastra\//],
    },
  },
})
