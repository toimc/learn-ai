import MarkdownIt from 'markdown-it'

let instance: MarkdownIt | null = null

export function useMarkdownIt(): MarkdownIt {
  if (instance) return instance
  instance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: true,
  })
  return instance
}

export function __resetMarkdownIt(): void {
  instance = null
}
