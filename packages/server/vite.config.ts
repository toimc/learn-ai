import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true, entryRoot: 'src', exclude: ['__tests__'] }),
  ],
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
      // hono 与 workspace 依赖保持 external，由消费侧安装；
      // node: 内置必须 external——bundler 的 polyfill 命名空间缺 promisify，
      // identity 的 scrypt 在 dist 里炸 "(0, L.promisify) is not a function"
      external: ['hono', /^@toimc\//, /^@mastra\//, /^node:/],
    },
  },
})
