import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'

let instance: MarkdownIt | null = null

export function useMarkdownIt(): MarkdownIt {
  if (instance) return instance
  instance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: true,
  }).use(taskLists, { enabled: true, label: true })
  return instance
}

export function __resetMarkdownIt(): void {
  instance = null
}
