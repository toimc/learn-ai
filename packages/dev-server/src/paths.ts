import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 从起始目录向上找本包（@toimc/dev-server）的 package.json 所在目录。
 * 必要性：mastra dev 是 bundle 运行——模块被内联进 .mastra/output/ 的产物里，
 * ① 目录层级与 src/ 不同，模块锚定会漂移；② **rebuild 会清空 .mastra/ 整个目录**，
 * 锚在其下的库随重启陪葬（Studio 历史反复丢失的根因）。
 * 以包名做标记上溯：bundle 内层的 package.json（name "server"）会被跳过，
 * 最终稳定命中包根，与 tsx / vitest 直跑（src/ 上一级）殊途同归。
 *
 * 独立成模块（而非放 memory.ts）：记忆/向量库等多处消费，且测试常整体
 * vi.mock memory 模块——路径工具不随记忆 mock 漂移。
 */
function resolvePkgRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        if (
          JSON.parse(readFileSync(pkgPath, 'utf8')).name === '@toimc/dev-server'
        ) {
          return dir
        }
      } catch {
        // 非法 JSON 视为非目标，继续上溯
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return startDir // 到根仍未命中：兜底旧行为（模块目录）
    dir = parent
  }
}

/** 落盘位置：包根 .temp/（.gitignore 任意层级；网关与 Studio 殊途同归同一文件） */
const PKG_TEMP_DIR = join(
  resolvePkgRoot(dirname(fileURLToPath(import.meta.url))),
  '.temp',
)

/** 包根 .temp/ 下库文件的统一 URL 构造（记忆库 / 向量库等沿用同锚定） */
export function tempDbUrl(filename: string): string {
  return `file:${tempFilePath(filename)}`
}

/** 同上，返回绝对路径（DuckDB 等直接吃 path 的组件用） */
export function tempFilePath(filename: string): string {
  return join(PKG_TEMP_DIR, filename)
}

/** libsql 本地文件模式不自动建父目录，目录缺失时 SQLITE_CANTOPEN 直接崩启动 */
export function ensureDbDir(url: string): void {
  if (!url.startsWith('file:')) return
  const path = url.slice('file:'.length)
  if (!path || path === ':memory:') return
  mkdirSync(dirname(path), { recursive: true })
}
