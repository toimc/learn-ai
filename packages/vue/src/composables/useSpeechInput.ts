import {
  ref,
  computed,
  onScopeDispose,
  getCurrentScope,
  type Ref,
  type ComputedRef,
} from 'vue'

/** 语音输入状态机：idle 未开始 / recording 录音采集 / recognizing 已停止采集、等待最终识别结果 */
export type SpeechInputStatus = 'idle' | 'recording' | 'recognizing'

export interface UseSpeechInputOptions {
  /** 识别语言（BCP-47），默认 'zh-CN' */
  lang?: string
}

/** SpeechRecognition 事件的最小结构（results 按序累积，每项取 [0].transcript） */
export interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

/** Web Speech API 识别实例的最小结构：DOM lib 类型覆盖不全且 webkit 前缀无类型，按用到的成员声明 */
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface UseSpeechInputReturn {
  /** 特性检测结果：Chrome/Edge 为 true，Firefox 等不支持时为 false（驱动按钮显隐） */
  supported: boolean
  /** 状态机当前值，onend 后回 idle */
  status: Ref<SpeechInputStatus>
  /** status !== 'idle' 的派生值，点击切换式录音按钮直接消费 */
  isRecording: ComputedRef<boolean>
  /** 实时识别文本（已定稿与中间结果的拼接），start 时清空、onend 后保留供调用方落进输入框 */
  interimText: Ref<string>
  /** 最近一次错误码（'unsupported' 或浏览器原生错误如 'no-speech'/'not-allowed'），start 时清空 */
  error: Ref<string>
  /** 开始录音：不支持时置 error 为 'unsupported'；重复调用会丢弃上一会话再新开 */
  start: () => void
  /** 停止采集进入 recognizing，等最终结果与 onend */
  stop: () => void
  /** 点击切换式：idle 时 start，录音中 stop */
  toggle: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Web Speech API 语音输入：单句模式（continuous=false），说完自动停；识别文本进输入框确认再发送 */
export function useSpeechInput(
  options?: UseSpeechInputOptions,
): UseSpeechInputReturn {
  const Ctor = getRecognitionCtor()
  const supported = !!Ctor
  const status = ref<SpeechInputStatus>('idle')
  const interimText = ref('')
  const error = ref('')
  const isRecording = computed(() => status.value !== 'idle')
  let recognition: SpeechRecognitionLike | null = null

  function start(): void {
    if (!Ctor) {
      error.value = 'unsupported'
      return
    }
    if (recognition) {
      // 上一会话可能卡在 recognizing（onend 未回）：先静默丢弃，避免状态被旧实例回调打回
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognition = null
    }
    interimText.value = ''
    error.value = ''
    const instance = new Ctor()
    recognition = instance
    instance.lang = options?.lang ?? 'zh-CN'
    instance.interimResults = true
    instance.continuous = false
    instance.onresult = (event) => {
      interimText.value = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
    }
    instance.onerror = (e) => {
      error.value = e.error
    }
    instance.onend = () => {
      if (recognition !== instance) return
      recognition = null
      status.value = 'idle'
    }
    instance.start()
    status.value = 'recording'
  }

  function stop(): void {
    if (!recognition) return
    status.value = 'recognizing'
    recognition.stop()
  }

  function toggle(): void {
    if (isRecording.value) stop()
    else start()
  }

  if (getCurrentScope()) {
    // 离开作用域必须释放麦克风；回调槽一并解绑，旧实例回调不再写入状态
    onScopeDispose(() => {
      if (!recognition) return
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognition = null
    })
  }

  return {
    supported,
    status,
    isRecording,
    interimText,
    error,
    start,
    stop,
    toggle,
  }
}
