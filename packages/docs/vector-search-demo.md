---
layout: VectorSearchDemoPage
title: 向量检索演示
---

本页连接本地 dev-server 的 `/vector` 端点，把 docs-agent 的语义检索升级**可视化**：同一查询同时跑两路，直观看到差别。

## 双路对比什么

| | 纯关键词路 | 语义混合路 |
|---|---|---|
| 原理 | 同义词表 + TF-IDF（标题命中 ×5） | 本地 `bge-m3` 向量召回 top8 + 关键词路 RRF 融合 |
| 强项 | 组件英文名精确查询（`MessageBubble`） | 口语化、换说法的查询（「支持英文」「夜间颜色不对」） |
| 失效场景 | 同义词表没覆盖的口语（0 命中） | Ollama 未启动时自动降级为关键词（页面会提示） |

试试示例查询「**怎么让组件库支持英文**」：左路 0 命中，右路命中 `guide/i18n.md`——同义词表没有「英文」这个词，向量按语义找到了国际化文档。

## 前置条件

```bash
# 1. 本地 Ollama + embedding 模型（一次性）
ollama pull bge-m3

# 2. .env 启用（packages/dev-server/.env）
EMBEDDING_MODEL=bge-m3

# 3. 文档入库（一次性，约 30 秒；文档变更后重跑）
cd packages/dev-server && pnpm index:docs
```

索引状态见页面顶部统计（模型 / 语义块数 / 维度）。接口明细见[接口文档](/mock-api)的「向量检索」分组：`GET /vector/stats`、`POST /vector/search`。
