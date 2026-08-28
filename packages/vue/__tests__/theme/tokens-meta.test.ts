import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokensMeta } from '../../src/theme/tokens-meta'
import type { TokenLayer, TokenType } from '../../src/theme/tokens-meta'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// 从 vue/src/theme/tokens-meta.test.ts → 仓库根
function resolveRepoRoot(start: string): string {
  let cur = start
  for (let i = 0; i < 10; i++) {
    if (
      statSafe(join(cur, 'packages'))?.isDirectory() &&
      statSafe(join(cur, 'package.json'))
    ) {
      return cur
    }
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return start
}
function statSafe(p: string) {
  try {
    return statSync(p)
  } catch {
    return undefined
  }
}
const REPO_ROOT = resolveRepoRoot(__dirname)
const TOKENS_CSS_PATH = join(REPO_ROOT, 'packages/vue/src/styles/tokens.css')

const VALID_LAYERS: TokenLayer[] = ['primitive', 'semantic', 'component']
const VALID_TYPES: TokenType[] = ['color', 'size', 'duration', 'font', 'text']

describe('tokensMeta 目录完整性', () => {
  it('每个 key 都以 --ai-chat- 开头', () => {
    for (const t of tokensMeta) {
      expect(t.key).toMatch(/^--ai-chat-/)
    }
  })

  it('无重复 (key, layer) 组合（同 key 跨 layer 允许，如 accent-hover 同时在 primitive 与 semantic）', () => {
    const seen = new Set<string>()
    const dups: string[] = []
    for (const t of tokensMeta) {
      const id = `${t.layer}::${t.key}`
      if (seen.has(id)) dups.push(id)
      seen.add(id)
    }
    expect(dups).toEqual([])
  })

  it('layer 字段全部合法', () => {
    for (const t of tokensMeta) {
      expect(VALID_LAYERS).toContain(t.layer)
    }
  })

  it('type 字段全部合法', () => {
    for (const t of tokensMeta) {
      expect(VALID_TYPES).toContain(t.type)
    }
  })

  it('derived token 必须带 ref（配置器展示需要）', () => {
    for (const t of tokensMeta) {
      if (t.derived) {
        expect(t.ref, `derived token ${t.key} 缺 ref`).toBeTruthy()
      }
    }
  })

  it('size/duration token 必须带 unit、min、max（滑块需要）', () => {
    for (const t of tokensMeta) {
      if (t.type === 'size' || t.type === 'duration') {
        expect(t.unit, `${t.key} 缺 unit`).toBeDefined()
        expect(t.min, `${t.key} 缺 min`).toBeDefined()
        expect(t.max, `${t.key} 缺 max`).toBeDefined()
      }
    }
  })

  it('layer 覆盖三层：primitive / semantic / component', () => {
    const layers = new Set(tokensMeta.map((t) => t.layer))
    expect(layers.has('primitive')).toBe(true)
    expect(layers.has('semantic')).toBe(true)
    expect(layers.has('component')).toBe(true)
  })

  it('亮色默认值 light 必填', () => {
    for (const t of tokensMeta) {
      expect(t.light, `${t.key} 缺 light`).toBeTruthy()
    }
  })
})

describe('tokensMeta 与 tokens.css 默认值一致（对账）', () => {
  // 从 tokens.css 解析 :root 块与 [data-theme='dark'] 块里的变量定义。
  // 同一 key 可能跨 layer 出现多次（primitive 的 #hex + semantic 的 var(...)），
  // 收集成 key → Set<value>，匹配时只要 meta 值在集合里即视为对账通过。
  const tokensCss = readFileSync(TOKENS_CSS_PATH, 'utf-8')

  function parseBlock(block: string): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>()
    const re = /^\s*(--ai-chat-[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(block))) {
      const set = map.get(m[1]) ?? new Set<string>()
      set.add(m[2].trim())
      map.set(m[1], set)
    }
    return map
  }

  function mergeInto(
    dst: Map<string, Set<string>>,
    src: Map<string, Set<string>>,
  ) {
    for (const [k, vs] of src) {
      const set = dst.get(k) ?? new Set<string>()
      for (const v of vs) set.add(v)
      dst.set(k, set)
    }
  }

  const rootBlocks = (tokensCss.match(/:root\s*\{([\s\S]*?)\}/g) ?? []).map(
    (b) => b.match(/\{([\s\S]*?)\}/)?.[1] ?? '',
  )
  const darkBlockInner =
    tokensCss.match(/\[data-theme=['"]?dark['"]?\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''

  const rootMap = new Map<string, Set<string>>()
  for (const b of rootBlocks) mergeInto(rootMap, parseBlock(b))
  const darkMap = parseBlock(darkBlockInner)

  it('tokensMeta 中每个 key 都在 tokens.css :root 里有定义', () => {
    const missing: string[] = []
    for (const t of tokensMeta) {
      if (!rootMap.has(t.key)) missing.push(t.key)
    }
    expect(missing, `tokens.css :root 缺定义: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('tokensMeta 中每个非 derived light 值都在 tokens.css :root 该 key 的值集合内', () => {
    const mismatches: string[] = []
    for (const t of tokensMeta) {
      if (t.derived) continue
      const cssVals = rootMap.get(t.key)
      if (cssVals && !cssVals.has(t.light)) {
        mismatches.push(
          `${t.key}: meta=${t.light} 不在 css 值集合 ${[...cssVals].join(' | ')}`,
        )
      }
    }
    expect(mismatches, `light 默认值不一致:\n${mismatches.join('\n')}`).toEqual(
      [],
    )
  })

  it('tokensMeta 中 derived light 值（var() 引用）在 tokens.css :root 该 key 的值集合内', () => {
    const mismatches: string[] = []
    for (const t of tokensMeta) {
      if (!t.derived) continue
      const cssVals = rootMap.get(t.key)
      if (cssVals && !cssVals.has(t.light)) {
        mismatches.push(
          `${t.key}: meta.light=${t.light} 不在 css 值集合 ${[...cssVals].join(' | ')}`,
        )
      }
    }
    expect(
      mismatches,
      `derived light 引用不一致:\n${mismatches.join('\n')}`,
    ).toEqual([])
  })

  it('tokensMeta 中给出 dark 值的令牌，dark 值在 tokens.css [data-theme=dark] 值集合内', () => {
    const mismatches: string[] = []
    for (const t of tokensMeta) {
      if (!t.dark) continue
      const cssVals = darkMap.get(t.key)
      if (cssVals && !cssVals.has(t.dark)) {
        mismatches.push(
          `${t.key}: meta.dark=${t.dark} 不在 css.dark 值集合 ${[...cssVals].join(' | ')}`,
        )
      }
    }
    expect(mismatches, `dark 默认值不一致:\n${mismatches.join('\n')}`).toEqual(
      [],
    )
  })
})

describe('反漂移：全仓 --ai-chat-* 引用必须在定义集合内或有 fallback', () => {
  // 已被标记 @deprecated 的旧组件（见 vue/src/index.ts）—— 用旧令牌名 + fallback，
  // 本阶段不重构，从反漂移扫描里排除
  const DEPRECATED_FILES = new Set([
    'ChatWindow.vue',
    'MessageList.vue',
    'MessageBubble.vue',
    'InputArea.vue',
  ])
  const SKIP_SEGMENTS = new Set(['node_modules', 'dist', '.git', '.claude'])

  // 构造"已定义"集合 = tokensMeta 所有 key + tokens.css 所有 :root/[data-theme] 定义
  const defined = new Set<string>()
  for (const t of tokensMeta) defined.add(t.key)
  const tokensCss = readFileSync(TOKENS_CSS_PATH, 'utf-8')
  for (const m of tokensCss.matchAll(/^\s*(--ai-chat-[a-zA-Z0-9-]+)\s*:/gm)) {
    defined.add(m[1])
  }

  function* walk(dir: string): Generator<string> {
    let ents: string[]
    try {
      ents = readdirSync(dir)
    } catch {
      return
    }
    for (const ent of ents) {
      if (SKIP_SEGMENTS.has(ent)) continue
      const p = join(dir, ent)
      const s = statSafe(p)
      if (!s) continue
      if (s.isDirectory()) yield* walk(p)
      else if (/\.(vue|css|ts)$/.test(extname(p))) yield p
    }
  }

  function* scan() {
    for (const file of walk(join(REPO_ROOT, 'packages'))) {
      const name = basename(file)
      if (DEPRECATED_FILES.has(name)) continue
      if (file.endsWith('.test.ts')) continue // 测试本身含大量 token 字符串
      // 跳过 docs/.vitepress/theme/style.css：那是主动定义旧令牌（非 var() 引用）
      if (file.includes(join('docs', '.vitepress'))) continue
      const content = readFileSync(file, 'utf-8')
      // var(--ai-chat-foo)  或  var(--ai-chat-foo, fallback)
      const re = /var\(\s*(--ai-chat-[a-zA-Z0-9-]+)\s*(,|\))/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content))) {
        const token = m[1]
        const hasFallback = m[2] === ','
        yield { path: relative(REPO_ROOT, file), token, hasFallback }
      }
    }
  }

  it('所有 --ai-chat-* 引用：已定义 或 带 fallback（旧令牌 graceful 降级）', () => {
    const naked: { path: string; token: string }[] = []
    for (const { path, token, hasFallback } of scan()) {
      if (defined.has(token)) continue
      if (hasFallback) continue
      naked.push({ path, token })
    }
    expect(
      naked,
      `发现未定义且无 fallback 的 --ai-chat-* 引用（sidebar 类断裂 bug）:\n${naked
        .map((n) => `  ${n.token}  in  ${n.path}`)
        .join('\n')}`,
    ).toEqual([])
  })

  it('回归保护：裸引用 var(--ai-chat-nonexistent-xxx) 会被检测', () => {
    // 确认扫描逻辑能识别"裸引用"（无 fallback）
    const fakeToken = '--ai-chat-nonexistent-test-token'
    const fakeRef = `var(${fakeToken})`
    expect(defined.has(fakeToken)).toBe(false)
    const m = fakeRef.match(/var\(\s*(--ai-chat-[a-zA-Z0-9-]+)\s*(,|\))/)
    expect(m).not.toBeNull()
    expect(m![2]).toBe(')')
  })
})
