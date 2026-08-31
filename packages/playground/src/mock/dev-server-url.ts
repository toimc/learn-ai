/**
 * dev-server 基地址的单一事实来源：所有演示页的请求地址从这里取。
 * 本地开发缺省 localhost:8787；部署构建用 VITE_DEV_SERVER_URL 覆盖——
 * 置空串时拼接产物为 '/api/...' 同域相对路径（nginx 反代 /api → dev-server），
 * 换域名 / 上 HTTPS 无需重新构建。
 */
export const DEV_SERVER_BASE_URL: string =
  import.meta.env.VITE_DEV_SERVER_URL ?? 'http://localhost:8787'
