import { ref, watch, onScopeDispose, getCurrentScope, type Ref } from 'vue'

/** 句子级切分结果 */
export interface SentenceSplitResult {
  /** 已凑满句末标点（。？！或换行）的完整句，标点保留在句尾，空白句已剔除 */
  complete: string[]
  /** 尾部未凑满句末标点的剩余文本，留待后续 chunk 拼接 */
  rest: string
}

// lookbehind 保证句末标点留在句内
const SENTENCE_BOUNDARY = /(?<=[。？！\n])/
const ENDS_WITH_BOUNDARY = /[。？！\n]$/

/** 流式缓冲的句子切分纯函数：凑满一句出一句（含以句末标点收尾的尾句），未凑满的留缓冲 */
export function splitSentences(buffer: string): SentenceSplitResult {
  const parts = buffer.split(SENTENCE_BOUNDARY)
  let rest = parts.pop() ?? ''
  // 尾段以句末标点收尾即是完整句：立即出队，不等下一个 chunk（否则流式回复的最后一句永远滞留缓冲）
  if (ENDS_WITH_BOUNDARY.test(rest)) {
    parts.push(rest)
    rest = ''
  }
  const complete = parts.filter((s) => s.trim() !== '')
  return { complete, rest }
}

export interface UseSpeechOutputOptions {
  /** 朗读语言（BCP-47），默认 'zh-CN'；主子标签同时用作 voice 匹配前缀 */
  lang?: string
}

export interface UseSpeechOutputReturn {
  /** 自动朗读开关：默认关闭，读写 localStorage 持久化；仅约束 feedChunk，不约束手动 speak */
  enabled: Ref<boolean>
  /** 是否有本实例入队的朗读正在进行（含排队中的句子），全部读完或 stop 后为 false */
  speaking: Ref<boolean>
  /** 流式 chunk 喂入：凑满一句入朗读队列；enabled 为 false 时直接丢弃 */
  feedChunk: (text: string) => void
  /** 整段文本朗读：先打断旧朗读，再按句入队，尾部无标点的残句也会朗读 */
  speak: (text: string) => void
  /** 打断：清空缓冲区并 cancel 朗读队列 */
  stop: () => void
  /** 切换自动朗读开关并持久化（不打断已入队的朗读） */
  toggle: () => void
}

const STORAGE_KEY = 'ai-chat-speech-output'

// 模块级单例开关：同一宿主内多处（开关 UI 与朗读按钮）共享同一份持久化状态
const enabled = ref(false)

if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') enabled.value = true
  } catch {
    // localStorage 不可用时保持默认关闭
  }
  watch(enabled, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(val))
    } catch {
      // 隐私模式等写入失败不阻断朗读功能本身
    }
  })
}

/** speechSynthesis 句子级朗读：流式文本凑满一句读一句，边生成边读 */
export function useSpeechOutput(
  options?: UseSpeechOutputOptions,
): UseSpeechOutputReturn {
  const lang = options?.lang ?? 'zh-CN'
  const speaking = ref(false)
  let buffer = ''
  let pendingCount = 0
  let pickedVoice: SpeechSynthesisVoice | null = null

  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : undefined

  // getVoices 异步加载：首次调用可能返回空数组，voiceschanged 后重新 pick
  function pickVoice(): void {
    if (!synth) return
    const primary = lang.split('-')[0].toLowerCase()
    pickedVoice =
      synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(primary)) ??
      null
  }

  function settle(): void {
    pendingCount = Math.max(0, pendingCount - 1)
    if (pendingCount === 0) speaking.value = false
  }

  function enqueue(sentence: string): void {
    if (!synth) return
    const utterance = new SpeechSynthesisUtterance(sentence)
    utterance.lang = lang
    if (pickedVoice) utterance.voice = pickedVoice
    pendingCount += 1
    speaking.value = true
    utterance.onend = () => settle()
    utterance.onerror = () => settle()
    synth.speak(utterance)
  }

  function feedChunk(text: string): void {
    if (!enabled.value || !synth) return
    buffer += text
    const { complete, rest } = splitSentences(buffer)
    buffer = rest
    for (const sentence of complete) enqueue(sentence)
  }

  function stop(): void {
    buffer = ''
    pendingCount = 0
    speaking.value = false
    synth?.cancel()
  }

  function speak(text: string): void {
    if (!synth) return
    stop()
    const { complete, rest } = splitSentences(text)
    for (const sentence of complete) enqueue(sentence)
    if (rest.trim() !== '') enqueue(rest)
  }

  function toggle(): void {
    enabled.value = !enabled.value
  }

  if (synth) {
    pickVoice()
    synth.addEventListener('voiceschanged', pickVoice)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      synth?.removeEventListener('voiceschanged', pickVoice)
    })
  }

  return { enabled, speaking, feedChunk, speak, stop, toggle }
}
