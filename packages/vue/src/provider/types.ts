/** 已注册 provider 的公开视图（id 由服务端生成，绝不含 apiKey；baseURL 非密钥，编辑预填回传） */
export interface ProviderOption {
  id: string
  name: string
  provider: string
  model?: string
  baseURL?: string
}

/** ProviderSettingsDialog 表单提交载荷（密钥仅在 emit 瞬间交宿主） */
export interface ProviderFormPayload {
  name: string
  provider: 'openai-compat' | 'anthropic'
  /** openai-compat 必填（预设自动填、可改）；anthropic 可选（官方端点） */
  baseURL?: string
  apiKey: string
  model: string
  /** 「记住配置」勾选状态：宿主据此决定是否持久化（组件自身不落任何存储） */
  persist?: boolean
}
