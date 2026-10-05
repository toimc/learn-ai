/** http(s) 白名单校验（frontend-security 第 4 条）：url 型来源渲染外链前必须通过 */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
