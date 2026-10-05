/**
 * wire 消息 content 的文本归一（课程 18-02 多模态透传配套）：
 * string 原样返回；OpenAI 兼容 parts 数组提取 text 拼接（image_url 不参与）；
 * 其余形态（null/对象/数字等不可信输入）归空串。mock 剧本匹配与会话持久化
 * 共用——两条消费路径都不允许把数组结构落数据库或剧本引擎。
 */
export function textContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .flatMap((part): string[] => {
      if (!part || typeof part !== 'object') return []
      const p = part as Record<string, unknown>
      return p.type === 'text' && typeof p.text === 'string' ? [p.text] : []
    })
    .join('')
}
