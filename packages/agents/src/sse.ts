/** SSE 帧：event 可选，data 为去掉 `data: ` 前缀的原始文本（可能多行） */
export interface SseFrame {
  event?: string
  data: string
}

/**
 * 解析 fetch 响应体的 SSE 字节流为帧序列。
 * 帧 separator 为空行（\n\n，容忍 \r\n）；`data:` 行可出现多次，
 * 多行 data 以 \n 拼接；`event:` 行可选；注释行（: 开头）与空帧跳过。
 * 流结束时缓冲区里未跟 separator 的尾帧仍解析（宽松收尾）。
 * signal 中止后正常结束（不抛错）。
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')

      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = parseFrame(buffer.slice(0, sep))
        buffer = buffer.slice(sep + 2)
        if (frame) yield frame
      }
    }
    const tail = parseFrame(buffer + decoder.decode())
    if (tail) yield tail
  } catch (err) {
    // reader.read 在中断时抛 AbortError，属正常结束
    if (!isAbortError(err)) throw err
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): SseFrame | null {
  const dataLines: string[] = []
  let event: string | undefined
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      const v = line.slice(5)
      dataLines.push(v.startsWith(' ') ? v.slice(1) : v)
    } else if (line.startsWith('event:')) {
      const v = line.slice(6)
      event = v.startsWith(' ') ? v.slice(1) : v
    }
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

/** 供适配器复用的中断判别（不进公共导出） */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
