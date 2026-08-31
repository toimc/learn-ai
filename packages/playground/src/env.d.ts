/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** dev-server 基地址覆盖：部署构建置空串 = 同域相对路径；缺省 localhost:8787 */
  readonly VITE_DEV_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
