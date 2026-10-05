// 模型 id → 厂商归类：前缀正则规则表（小写、先命中先归），
// 规则数据源自 toimc-sub2api modelVendor.ts（对齐其后端 DetectModelPlatform），
// 厂商枚举按本库 T1 契约重命名：gemini→google、grok→xai、glm→zhipu、kimi→moonshot、other→unknown。

export type ModelVendor =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'zhipu'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'meta'
  | 'cohere'
  | 'yi'
  | 'xai'
  | 'moonshot'
  | 'doubao'
  | 'minimax'
  | 'wenxin'
  | 'unknown'

export interface VendorInfo {
  vendor: ModelVendor
  /** 厂商展示名（品牌名不翻译，zh/en 同形）；unknown 为空串，由调用方注入本地化文案 */
  label: string
  /** 命中规则说明（正则 source，调试用）；unknown 时缺省 */
  matchedBy?: string
}

/** 前缀→厂商（顺序即优先级，先命中先归） */
const VENDOR_RULES: ReadonlyArray<readonly [ModelVendor, RegExp]> = [
  ['anthropic', /^claude-|^anthropic\.claude-/],
  [
    'openai',
    /^gpt-|^chatgpt-|^codex-|^gpt-image-|^dall-e-|^tts-|^whisper-|^o[1-9](-|$)/,
  ],
  ['google', /^gemini-|^learnlm-/],
  ['zhipu', /^glm-|^chatglm/],
  ['deepseek', /^deepseek-/],
  ['qwen', /^qwen/],
  ['mistral', /^mistral-|^mixtral|^codestral|^ministral|^pixtral/],
  ['meta', /^meta-llama|^llama/],
  ['cohere', /^command|^c4ai/],
  ['yi', /^yi-/],
  ['xai', /^grok-/],
  ['moonshot', /^kimi-|^moonshot-|^k3(-|$)/],
  ['minimax', /^minimax-|^abab[5-9]/],
  ['doubao', /^doubao-/],
  ['wenxin', /^ernie|^wenxin/],
]

/** 分组输出与展示的主顺序（unknown 兜底最后） */
export const VENDOR_ORDER: readonly ModelVendor[] = [
  'openai',
  'anthropic',
  'google',
  'zhipu',
  'qwen',
  'deepseek',
  'mistral',
  'meta',
  'cohere',
  'yi',
  'xai',
  'moonshot',
  'doubao',
  'minimax',
  'wenxin',
  'unknown',
]

/** 厂商展示名（品牌名不翻译）；unknown 为空串，由调用方注入本地化文案 */
export const VENDOR_LABELS: Record<ModelVendor, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  zhipu: 'Zhipu',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  meta: 'Meta',
  cohere: 'Cohere',
  yi: 'Yi',
  xai: 'xAI',
  moonshot: 'Moonshot',
  doubao: 'Doubao',
  minimax: 'MiniMax',
  wenxin: 'Wenxin',
  unknown: '',
}

/** 模型 id → 厂商。斜杠前缀（openrouter/anthropic/xxx）先取末段再匹配。 */
export function detectModelVendor(modelId: string): VendorInfo {
  const m = modelId.trim().toLowerCase()
  if (!m) return { vendor: 'unknown', label: '' }
  const last = m.includes('/') ? m.slice(m.lastIndexOf('/') + 1) : m
  for (const [vendor, re] of VENDOR_RULES) {
    if (re.test(last)) {
      return { vendor, label: VENDOR_LABELS[vendor], matchedBy: re.source }
    }
  }
  return { vendor: 'unknown', label: '' }
}

/** 按 vendor 分组（组内保持输入顺序）；返回 Record 含全部厂商键，unknown 归 'unknown' 键 */
export function groupModelsByVendor(
  modelIds: string[],
): Record<ModelVendor, string[]> {
  const groups = {} as Record<ModelVendor, string[]>
  for (const vendor of VENDOR_ORDER) groups[vendor] = []
  for (const id of modelIds) {
    groups[detectModelVendor(id).vendor].push(id)
  }
  return groups
}
