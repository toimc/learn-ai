export function extractCompleteMarkdown(buffer: string): string {
  if (!buffer) return ''
  let safe = buffer
  const fenceCount = (safe.match(/```/g) ?? []).length
  if (fenceCount % 2 === 1) safe = safe.slice(0, safe.lastIndexOf('```'))
  const dollarCount = (safe.match(/\$\$/g) ?? []).length
  if (dollarCount % 2 === 1) safe = safe.slice(0, safe.lastIndexOf('$$'))
  return safe
}
