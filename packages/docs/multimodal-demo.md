---
layout: MultimodalDemoPage
title: 多模态输入演示
---

本页是多模态输入的**真发送链路**演示：选图 → `compressImageToDataUrl`（长边 1024 / JPEG 0.85，原图 3MB 压到 100-300KB）→ `Attachment.dataUrl` → SSE adapter 组装 OpenAI 兼容 parts 数组 → dev-server。完整链路说明见[多模态发送指南](/guide/multimodal)。

## 试一下

1. 点击图片图标选一张截图（或直接粘贴 / 拖拽进来），输入「这张图里是什么」，Enter 发送
2. 下方 payload 面板实时展示发送的线协议形状（附件名 / 类型 / 大小 / 是否带 dataUrl）
3. dev-server 配了 `MASTRA_MODEL` 时回复会引用图片内容；没配时 mock 后端忽略图片照常回文本——**链路不报错，优雅降级**

## 与 mock 回显时代的差别

此前本页只回显 `send` 事件 payload（不走网络）；现在真的发出去：图片以 base64 dataUrl 进 `messages[].content` 的 `image_url` part（组装逻辑在 `createSseAdapter` 的 `toWireContent`，宿主 demo 无需手写映射）。预览用同一个压缩产物（`url` 与 `dataUrl` 同值），不经 `createObjectURL`，无 blob 失效窗口。完整聊天场景（含消息流、多会话）见 [Playground](/playground)。
