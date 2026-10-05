---
layout: VoiceDemoPage
title: 语音输入与朗读演示
---

浏览器原生 Web Speech API 的完整接线演示，零依赖零费用。Composable API 细节见[语音指南](/guide/speech)。

## 三块能力

| 能力 | 接线 | 行为 |
|---|---|---|
| **语音输入** | [`PromptInputMicButton`](/components/prompt-input#promptinputmicbutton) | 点击录音（仅 Chrome/Edge 显示按钮），实时字幕跟随；说完落输入框，确认再发送 |
| **消息朗读** | [`MessageActionSpeak`](/components/message-actions#messageactionspeak) | 回复 hover 出现喇叭按钮，点击逐句朗读；朗读中变「停止」，再点打断 |
| **自动朗读** | `useSpeechOutput` + `useChat` 的 `onResponse` | 开关默认关，开启后流式回复凑满一句读一句（边生成边读）；偏好 localStorage 持久化 |

## 试试

1. 点输入框左侧麦克风说一句话（如「介绍一下这个页面的功能」），字幕实时出现，说完文本落进输入框，Enter 发送
2. 回复出现后 hover 消息，点喇叭按钮听整段朗读
3. 打开「自动朗读」开关再发一条——这次不等说完，回复**边流式边朗读**
4. 发送新消息时旧朗读自动打断（发送前 `stop()` 的接线位置）
