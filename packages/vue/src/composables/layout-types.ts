import { inject, type ComputedRef, type InjectionKey } from 'vue'

export type MessageLayout = 'stacked' | 'im'
export type MessageAlign = 'left' | 'right'

export interface MessageLayoutContext {
  layout: MessageLayout
  messageAlign: MessageAlign
}

export const messageLayoutKey: InjectionKey<ComputedRef<MessageLayoutContext>> =
  Symbol('messageLayout')

/** 读取 Conversation 下发的布局上下文；未注入时返回 undefined（回退现状） */
export function useMessageLayout():
  ComputedRef<MessageLayoutContext> | undefined {
  return inject(messageLayoutKey, undefined)
}
