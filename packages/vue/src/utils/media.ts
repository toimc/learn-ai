export function getMediaCategory(
  mediaType: string,
): 'image' | 'video' | 'audio' | 'document' {
  if (mediaType.startsWith('image/')) return 'image'
  if (mediaType.startsWith('video/')) return 'video'
  if (mediaType.startsWith('audio/')) return 'audio'
  return 'document'
}

export function getFileIcon(mediaType: string): string {
  const category = getMediaCategory(mediaType)
  const map: Record<string, string> = {
    document: '📄',
    audio: '🎵',
    video: '🎬',
  }
  return map[category] || '📄'
}

export function getAttachmentLabel(mediaType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/json': 'JSON',
    'application/zip': 'ZIP',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  }
  return map[mediaType] || mediaType.split('/')[1]?.toUpperCase() || 'FILE'
}
