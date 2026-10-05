---
title: 语音输入与输出
---

# 语音输入与输出

浏览器原生的 Web Speech API 提供了两块零依赖、零费用的语音能力：`SpeechRecognition`（语音转文本，Chrome/Edge 挂在 `webkitSpeechRecognition` 上）与 `speechSynthesis`（文本转语音）。本页的两个 composable 把它们封装成组件库级别的公共 API：

- `useSpeechInput`：点击切换式单句语音输入，识别文本进输入框确认再发送
- `useSpeechOutput`：speechSynthesis 句子级朗读，流式回复边生成边读，自动朗读开关默认关闭并持久化

均从 `@toimc/vue` 导出，配合纯函数 `splitSentences`（流式缓冲的句子切分）一起使用。

## useSpeechInput

### 特性检测

Chrome/Edge 支持语音识别，Firefox 不支持。构造时做特性检测，`supported` 驱动录音按钮显隐：

```ts
const { supported } = useSpeechInput()
// 模板里：v-if="supported" 渲染麦克风按钮
```

### 状态机

```text
idle ──start()──▶ recording ──stop()──▶ recognizing ──onend──▶ idle
                    │ 单句模式说完自动停（continuous=false，触发 onend）
                    └──────────────────────────┘
```

| 状态 | 含义 |
|------|------|
| `idle` | 未开始，或本轮识别已结束（onend 已触发） |
| `recording` | 录音采集进行中（start() 已调用） |
| `recognizing` | 已调用 stop() 停止采集，等待最终识别结果与 onend |

`isRecording` 是 `status !== 'idle'` 的派生值，点击切换式录音按钮直接消费（`isRecording` 为 true 时点击调 stop，否则调 start——或直接用 `toggle`）。

### API

```ts
function useSpeechInput(options?: { lang?: string }): {
  supported: boolean
  status: Ref<'idle' | 'recording' | 'recognizing'>
  isRecording: ComputedRef<boolean>
  interimText: Ref<string>
  error: Ref<string>
  start: () => void
  stop: () => void
  toggle: () => void
}
```

| 成员 | 行为 |
|------|------|
| `options.lang` | 识别语言（BCP-47），默认 `'zh-CN'` |
| `supported` | 浏览器是否支持（SSR 环境恒为 false） |
| `interimText` | 实时识别文本：已定稿与中间结果的拼接，驱动输入框实时字幕。`start()` 时清空；`onend` 后**保留**，供调用方在录音结束后落进输入框 |
| `error` | 最近一次错误码：不支持时调用 start 置 `'unsupported'`；其余为浏览器原生错误码（`'no-speech'` / `'not-allowed'` / `'network'` 等）。`start()` 时清空。错误文案的 i18n 翻译由 UI 层负责 |
| `start()` | 开始录音。实例固定 `interimResults=true`（实时字幕）与 `continuous=false`（单句模式，说完自动停）。已在录音中时重复调用会先丢弃上一会话再新开；不支持时只置 error 不抛异常 |
| `stop()` | 停止采集，status 进入 `recognizing`，等最终结果与 onend |
| `toggle()` | 点击切换式：idle 时 start，录音中 stop |

行为边界：

- 识别结束（onend 触发、status 回 idle）后 `interimText` 保留最终文本，典型接线是在 `watch(isRecording)` 为 false 时把它追加进输入框，用户确认编辑后再发送——语音识别不是 100% 准，直接发送容易翻车
- 组件作用域销毁时自动 `abort()` 释放麦克风
- SSR（VitePress 等服务端环境）下安全：`window` 访问有环境判断，`supported` 为 false，调用 `start()` 只置 error 不抛异常

## splitSentences

流式缓冲的句子切分纯函数，`useSpeechOutput` 内部用它实现"凑满一句读一句"：

```ts
function splitSentences(buffer: string): {
  /** 已凑满句末标点的完整句（标点保留在句尾），空白句已剔除 */
  complete: string[]
  /** 尾部未凑满句末标点的剩余文本，留待后续 chunk 拼接 */
  rest: string
}
```

句末标点集为 `。？！` 与换行符，正则用 lookbehind 切分保证标点留在句内。凑满句末标点的句子（**含以句末标点收尾的尾段**）立即进 complete——流式回复以句号收尾时最后一句即刻入队朗读，不滞留缓冲；未凑满的尾句留 rest 等下一个 chunk 拼接：

```ts
splitSentences('你好。今天天气怎么样？我')
// { complete: ['你好。', '今天天气怎么样？'], rest: '我' }

splitSentences('你好。今天天气怎么样？')
// 尾段已以问号收尾，是完整句：{ complete: ['你好。', '今天天气怎么样？'], rest: '' }

splitSentences('第一段。\n\n第二段还没说完')
// 切分点逐字符判定：'第一段。' | '\n' | '\n' | '第二段还没说完'
// { complete: ['第一段。'], rest: '第二段还没说完' }（两个 '\n' 是空白句，被剔除）
```

## useSpeechOutput

### 为什么是句子级朗读

AI 回复逐 token 流式到达，一条 300 token 的回复要流十几秒——等全文拼完再朗读，用户盯着屏幕半天听不到声音。句子级 TTS 的解法：流式 chunk 进缓冲区，凑满一句（句末标点或换行）就立即入 `speechSynthesis` 队列（浏览器自带队列逐句顺序朗读），边生成边读。

### API

```ts
function useSpeechOutput(options?: { lang?: string }): {
  enabled: Ref<boolean>
  speaking: Ref<boolean>
  feedChunk: (text: string) => void
  speak: (text: string) => void
  stop: () => void
  toggle: () => void
}
```

| 成员 | 行为 |
|------|------|
| `options.lang` | 朗读语言（BCP-47），默认 `'zh-CN'`；主子标签同时用作本地 voice 的匹配前缀（如 `zh-CN` 匹配任意 `zh` 开头的 voice） |
| `enabled` | 自动朗读开关，**默认关闭**（自动朗读对很多用户是打扰不是福利）。读写 localStorage（key 为 `ai-chat-speech-output`，存 `'true'`/`'false'`）持久化，同一页面多处实例共享同一份状态；损坏或不可用的存储值一律回退关闭。仅约束 `feedChunk`，不约束手动 `speak` |
| `speaking` | 是否有本实例入队的朗读正在进行（含排队中的句子）。入队即置 true；全部句子朗读完（每句 onend/onerror）或调用 `stop()` 后回 false |
| `feedChunk(text)` | 流式 chunk 喂入：文本进缓冲区，凑满一句入朗读队列，尾句留缓冲。`enabled` 为 false 时**直接丢弃**（不缓冲不朗读）。新一条消息开始前应先 `stop()` 清理旧队列 |
| `speak(text)` | 整段文本朗读（消息级"朗读这条消息"按钮用）：先打断旧朗读（清队 cancel），再把文本按句入队，**尾部没有句末标点的残句也会朗读**。不受 `enabled` 开关限制——手动点击是显式意图 |
| `stop()` | 打断：清空缓冲区、cancel 朗读队列、speaking 回 false。新消息来了立即停旧朗读就用它 |
| `toggle()` | 切换自动朗读开关并持久化；不打断已入队的朗读 |

### voice 选择的坑

`getVoices()` 是异步加载的，首次调用可能返回空数组。composable 内部监听 `voiceschanged` 事件重新 pick 匹配语言的 voice；pick 不到时只设 `utterance.lang` 交给浏览器默认声音。

### 接线：useChat 的 onResponse

流式自动朗读的推荐接入点是 `useChat` 的 `onResponse` 回调（每个 chunk 都会透传），`chunk.type === 'text'` 时喂给 `feedChunk`：

```ts
const { enabled, feedChunk, stop } = useSpeechOutput()

const chat = useChat(adapter, {
  onResponse(chunk) {
    if (chunk.type === 'text') feedChunk(chunk.content)
  },
})

// 发送新消息前打断上一条的朗读
function handleSend() {
  stop()
  chat.send(/* ... */)
}
```

### UI 接线点

两颗开箱组件已落地（也可参照它们直接消费 composable）：

- **输入区麦克风按钮**：[`PromptInputMicButton`](/components/prompt-input#promptinputmicbutton)——放进 PromptInput 工具区即得完整语音输入体验：`supported` 驱动显隐、录音中脉冲动效、`interimText` 实时字幕、录音结束自动把识别文本追加进输入框、错误码翻译成人话文案（`speechErrors.unsupported` / `noSpeech` / `notAllowed`，未知码原样展示）
- **消息级朗读按钮**：[`MessageActionSpeak`](/components/message-actions#messageactionspeak)——与 `MessageActionCopy` / `MessageActionRetry` 并列放进 `MessageActions`，hover 出现、朗读中变"停止"（`speaking` 驱动），点击调 `speak(message.content)`

### 云端方案对比

浏览器内置 voice 偏机械感；Whisper API（约 $0.006/分钟）、OpenAI TTS、火山引擎、GLM 语音等云端方案音色自然、噪声鲁棒性更好，但按量收费且要上传音频多一次网络往返。策略是免费方案先跑通，不够再升级——两者都封装在同一 composable 接口后面，上层代码无感切换。
