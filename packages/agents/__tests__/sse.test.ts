import { describe, expect, it } from 'vitest'
import { parseSseStream } from '@toimc/agents'
import type { SseFrame } from '@toimc/agents'

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body!
}

function chunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collectFrames(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): Promise<SseFrame[]> {
  const frames: SseFrame[] = []
  for await (const frame of parseSseStream(stream, signal)) frames.push(frame)
  return frames
}

describe('parseSseStream', () => {
  it('按空行分帧：event 行进 frame.event，data 前缀剥离', async () => {
    const frames = await collectFrames(
      streamOf('event: chunk\ndata: {"a":1}\n\ndata: {"b":2}\n\n'),
    )
    expect(frames).toEqual([
      { event: 'chunk', data: '{"a":1}' },
      { data: '{"b":2}' },
    ])
  })

  it('data: 前缀带或不带空格均可，一个帧内多行 data 以 \\n 拼接', async () => {
    const frames = await collectFrames(
      streamOf('data:first\ndata: second\n\ndata:{"c":3}\n\n'),
    )
    expect(frames).toEqual([{ data: 'first\nsecond' }, { data: '{"c":3}' }])
  })

  it('容忍 CRLF 行尾', async () => {
    const frames = await collectFrames(
      streamOf('event: chunk\r\ndata: hello\r\n\r\ndata: world\r\n\r\n'),
    )
    expect(frames).toEqual([
      { event: 'chunk', data: 'hello' },
      { data: 'world' },
    ])
  })

  it('注释行跳过，无 data 行的帧整帧跳过', async () => {
    const frames = await collectFrames(
      streamOf(': keep-alive\n\nevent: ping\n\n: note\ndata: real\n\n'),
    )
    expect(frames).toEqual([{ data: 'real' }])
  })

  it('流结束时未跟 separator 的尾帧若含 data 行也吐出', async () => {
    const frames = await collectFrames(streamOf('data: a\n\ndata: tail'))
    expect(frames).toEqual([{ data: 'a' }, { data: 'tail' }])
  })

  it('尾帧不含 data 行时不产出该帧', async () => {
    const frames = await collectFrames(streamOf('data: a\n\nevent: orphan'))
    expect(frames).toEqual([{ data: 'a' }])
  })

  it('空流产出零帧且不抛错', async () => {
    expect(await collectFrames(streamOf(''))).toEqual([])
  })

  it('传入已 abort 的 signal 时不产出任何帧且不抛错', async () => {
    const controller = new AbortController()
    controller.abort()
    const frames = await collectFrames(
      streamOf('data: x\n\ndata: y\n\n'),
      controller.signal,
    )
    expect(frames).toEqual([])
  })

  it('分块边界切断帧与 CRLF 分隔符仍正确解析', async () => {
    const frames = await collectFrames(
      chunkedStream([
        'event: chu',
        'nk\nda',
        'ta: {"a":1}',
        '\n\ndata: {"b"',
        ':2}\n\n',
        'data: c\r',
        '\n\r',
        '\ndata: d\r\n\r\n',
      ]),
    )
    expect(frames).toEqual([
      { event: 'chunk', data: '{"a":1}' },
      { data: '{"b":2}' },
      { data: 'c' },
      { data: 'd' },
    ])
  })
})
