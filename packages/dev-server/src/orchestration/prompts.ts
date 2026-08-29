/**
 * 编排 prompt 模板与 verdict 解析（spec 16 §4 字面量）：
 * 手搓 patterns.ts 与原生 Workflow 共用同一套模板——两层的角色人设与输出契约保持一致。
 * 字符串被 __tests__/orchestration/patterns.test.ts 的字面量断言钉死，改动即红。
 */

/** reviewer 首行 verdict 宽容解析：[pass]/[revise] 不区分大小写，无法解析默认 pass */
export function parseVerdict(text: string): 'pass' | 'revise' {
  const firstLine = (text.split('\n')[0] ?? '').trim().toLowerCase()
  if (firstLine.startsWith('[revise]')) return 'revise'
  if (firstLine.startsWith('[pass]')) return 'pass'
  return 'pass'
}

const DRAFT_PROMPT_SUFFIX = '请基于以上检索结果起草回答。'

/** 起草：writer 收任务 + 检索结果（delegate 首轮与 pipeline 首轮同款） */
export function draftPrompt(task: string, researchOutput: string): string {
  return `任务：${task}\n检索结果：\n${researchOutput}\n${DRAFT_PROMPT_SUFFIX}`
}

/** 审查：reviewer 对照检索结果审草稿，首行输出 [pass]/[revise] */
export function reviewPrompt(
  task: string,
  researchOutput: string,
  draft: string,
): string {
  return `任务：${task}\n检索结果：\n${researchOutput}\n草稿：\n${draft}\n审查以上草稿：首行输出 [pass] 或 [revise]，随后给出意见。`
}

/** 打回重写：writer 收上一版草稿 + 审查意见 */
export function revisePrompt(
  task: string,
  researchOutput: string,
  draft: string,
  reviewOutput: string,
): string {
  return `任务：${task}\n检索结果：\n${researchOutput}\n上一版草稿：\n${draft}\n审查意见：\n${reviewOutput}\n请根据审查意见重写回答。`
}

/** 并行检索角度提示 */
export function parallelPrompt(task: string, angle: string): string {
  return `${task}\n检索角度：${angle}`
}
