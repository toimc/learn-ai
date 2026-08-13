export interface ThemePreset {
  name: string
  /** 只含原始层 accent 色阶变量 */
  vars: Record<string, string>
}

export const presets: Record<string, ThemePreset> = {
  default: {
    name: '默认靛蓝',
    vars: {
      '--ai-chat-color-accent-500': '#6366f1',
      '--ai-chat-color-accent-600': '#4f46e5',
      '--ai-chat-color-accent-hover': '#818cf8',
    },
  },
  purple: {
    name: '优雅紫',
    vars: {
      '--ai-chat-color-accent-500': '#8b5cf6',
      '--ai-chat-color-accent-600': '#7c3aed',
      '--ai-chat-color-accent-hover': '#a78bfa',
    },
  },
  green: {
    name: '自然绿',
    vars: {
      '--ai-chat-color-accent-500': '#059669',
      '--ai-chat-color-accent-600': '#047857',
      '--ai-chat-color-accent-hover': '#10b981',
    },
  },
  warm: {
    name: '暖橙',
    vars: {
      '--ai-chat-color-accent-500': '#ea580c',
      '--ai-chat-color-accent-600': '#c2410c',
      '--ai-chat-color-accent-hover': '#f97316',
    },
  },
}

export type PresetKey = keyof typeof presets
