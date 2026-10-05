/**
 * dev-server 的 OpenAPI 3.1 规范。
 * 由 GET /api/openapi.json 输出，文档站 Scalar 页面加载渲染，
 * Test Request 直接打到 servers[0].url（CORS 已放开）。
 */
// Vercel 函数环境注入 VERCEL=1：servers 用空串相对 URL，
// Scalar Test Request 相对当前部署域名（同源）；本地开发指向 8787。
const serverUrl = process.env.VERCEL ? '' : 'http://localhost:8787'
const runNote = process.env.VERCEL
  ? '\n\n**执行说明**：页面上的 Test Request 会直接请求当前部署域名（同源）。'
  : '\n\n**执行说明**：页面上的 Test Request 会直接请求 `http://localhost:8787`（已开 CORS）。请先在项目根目录运行 `pnpm dev` 同时启动文档站与本服务。'

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'ai-chat-ui Mock Server',
    version: '0.2.0',
    description: [
      '本地开发服务端：为组件库 Playground 与文档站提供多会话数据源、SSE 流式对话与用户体系演示。',
      runNote,
      '\n\n## 运行模式（由环境变量门控）',
      '\n\n- **mock 模式（默认）**：未配置 `MASTRA_MODEL` 时，按消息关键词回放剧本（思考 / 工具 / 错误 / 慢速 / markdown），零外部依赖。',
      '\n- **真实 agent 模式**：配置 `MASTRA_MODEL`（如 `deepseek/deepseek-chat`）后注册 docs-agent 等真实模型，支持工具调用、会话记忆与 RAG 检索；`/api/models` 列表随之扩展。',
      '\n\n## 认证模式（`AUTH_MODE`）',
      '\n\n- **`static`（默认）**：配置 `MASTRA_TOKEN` 时 `/api/chat` 与 `/api/models` 校验静态 Bearer 白名单；不配置则完全开放。',
      '\n- **`user`**：启用「认证」分组的用户体系——注册 / 登录签发短时效 JWT（15 分钟），可签发 `sk-aichat-` 前缀 API Key；`/api/chat` 与 `/api/models` 要求 `Authorization: Bearer <JWT|API Key>`，叠加**每用户每日配额**（free 20 / pro 200，超额 402 引导升级）与 **thread 归属隔离**（会话首次使用即归属，他人访问 403），并按用户记账 token 用量。',
      '\n\n## SSE 线格式',
      '\n\n`POST /api/chat` 与 `POST /api/workflows/{id}/run` 的每个事件为 `event: chunk` + `data: <StreamChunk JSON>`，',
      '与 `@toimc/core` 的 `StreamChunk` 同构（text / thinking / tool_call / tool_result / error / done）。',
      '收尾 `done` 帧在 `metadata.usage` 回传本轮 token 用量（`inputTokens` / `outputTokens`，mock 与真实模型均携带）。',
      '\n\n## 多模态消息',
      '\n\n`POST /api/chat` 的 user 消息 `content` 支持字符串或 OpenAI 兼容 parts 数组（`text` + `image_url`）：',
      'mock 模式提取文字部分匹配剧本；配置 `MASTRA_MODEL` 后透传给多模态模型。',
      '\n\n## 向量检索',
      '\n\n「向量检索」分组三端点（`/api/vector/*`）是 docs-agent 语义检索的运维与调试面：',
      '索引统计、关键词/语义双路对比、向量库分页浏览。未配置 `EMBEDDING_MODEL` 时语义路自动降级为关键词。',
    ].join(''),
  },
  servers: [{ url: serverUrl, description: '本地 mock 服务' }],
  tags: [
    { name: '会话', description: '多会话数据源：列表 / 历史 / 新建' },
    { name: '对话', description: '流式对话：SSE 逐块输出 StreamChunk' },
    { name: '元信息', description: '模型列表与探活' },
    {
      name: 'Provider',
      description: '运行时注册真实模型：注册为带工具与会话记忆的 Mastra Agent',
    },
    {
      name: '认证',
      description:
        '用户体系（AUTH_MODE=user）：注册登录签发 JWT、API Key 签发与撤销',
    },
    {
      name: '工作流',
      description: '多 Agent 协作编排（需配置 MASTRA_MODEL）：列表与 SSE 运行',
    },
    {
      name: '向量检索',
      description:
        '文档语义索引统计与关键词/语义双路对比（vector-search-demo 数据源）',
    },
  ],
  paths: {
    '/api/conversations': {
      get: {
        tags: ['会话'],
        summary: '会话列表',
        description:
          '返回全部会话摘要，按 updatedAt 倒序。种子数据 + 运行期新建的会话。',
        operationId: 'listConversations',
        responses: {
          200: {
            description: '会话列表',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    conversations: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/ConversationSummary',
                      },
                    },
                  },
                  required: ['conversations'],
                },
                example: {
                  conversations: [
                    {
                      id: 'conv_vue',
                      title: 'Vue 3 响应式答疑',
                      description: 'ref 与 reactive 的取舍、侦听器用法',
                      updatedAt: '2026-08-19T10:20:00.000Z',
                      messageCount: 4,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['会话'],
        summary: '新建会话',
        description: '创建一个空会话（内存存储，服务重启后还原为种子数据）。',
        operationId: 'createConversation',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: '会话标题，缺省为「新对话」',
                  },
                },
              },
              example: { title: '新话题' },
            },
          },
        },
        responses: {
          201: {
            description: '创建成功，返回完整会话',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConversationDetail' },
              },
            },
          },
        },
      },
    },
    '/api/conversations/{id}/messages': {
      get: {
        tags: ['会话'],
        summary: '会话历史消息',
        description:
          '拉取指定会话的全部消息（含 thinking / toolCalls 形态）。发送过的新对话也会写回这里。',
        operationId: 'getConversationMessages',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'conv_vue',
            description: '会话 id（从会话列表获取）',
          },
        ],
        responses: {
          200: {
            description: '消息列表',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    messages: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ChatMessage' },
                    },
                  },
                  required: ['id', 'messages'],
                },
              },
            },
          },
          404: { description: '会话不存在' },
        },
      },
    },
    '/api/chat': {
      post: {
        tags: ['对话'],
        summary: '发送消息（SSE 流式回复）',
        description: [
          '按最后一条用户消息中的关键词选择剧本，以 `text/event-stream` 逐块输出 StreamChunk：',
          '\n- 触发词 `思考 / thinking`：先 thinking 块后 text 块',
          '\n- 触发词 `工具 / tool / 天气`：tool_call → tool_result → text',
          '\n- 触发词 `错误 / error`：正文输出一半后 error 块收尾',
          '\n- 触发词 `慢速 / slow`：块间隔约 500ms',
          '\n- 触发词 `markdown`：富 Markdown 剧本',
          '\n- 其他：引用输入片段的默认回复',
          '\n\n流结束后这一轮对话会写回 `conversationId` 对应会话的历史。',
        ].join(''),
        operationId: 'chat',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequestBody' },
              examples: {
                思考剧本: {
                  value: {
                    conversationId: 'conv_vue',
                    messages: [
                      { role: 'user', content: '思考一下流式渲染的安全问题' },
                    ],
                    speed: 1,
                  },
                },
                工具剧本: {
                  value: {
                    messages: [{ role: 'user', content: '查一下上海天气' }],
                  },
                },
                多模态: {
                  summary: '图片 + 文字（content 为 parts 数组）',
                  value: {
                    messages: [
                      {
                        role: 'user',
                        content: [
                          { type: 'text', text: '这个报错怎么解决' },
                          {
                            type: 'image_url',
                            image_url: {
                              url: 'data:image/png;base64,iVBORw0KGgo=',
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'SSE 流：每个事件为 `event: chunk`，data 为 StreamChunk JSON，最后一块 type=done（metadata.usage 回传 token 用量）',
            content: {
              'text/event-stream': {
                schema: { $ref: '#/components/schemas/StreamChunk' },
                example: [
                  'event: chunk\ndata: {"type":"thinking","content":"先把问题拆开…"}',
                  'event: chunk\ndata: {"type":"text","content":"流式回复正文"}',
                  'event: chunk\ndata: {"type":"done","content":"","metadata":{"usage":{"inputTokens":18,"outputTokens":96}}}',
                ].join('\n\n'),
              },
            },
          },
          400: { description: 'messages 缺失或为空，或 model 未注册' },
          401: {
            description:
              '未认证：static 模式配置 MASTRA_TOKEN 后需 Bearer；user 模式（AUTH_MODE=user）需 Bearer JWT 或 API Key',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'Unauthorized' },
              },
            },
          },
          402: {
            description:
              '每日配额用完（仅 user 模式）：引导升级而非报错，retry-after 为距 UTC 次日零点的秒数',
            headers: {
              'retry-after': {
                schema: { type: 'integer' },
                description: '距配额重置（UTC 次日零点）的秒数',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QuotaExceededBody' },
                example: {
                  error: '今日免费额度已用完，明日重置或升级套餐',
                  code: 'QUOTA_EXCEEDED',
                  quota: 20,
                  upgradeUrl: '/pricing',
                },
              },
            },
          },
          403: {
            description:
              '会话归属校验失败（仅 user 模式）：conversationId 已归属其他用户（IDOR 防线）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: {
                  error: 'Forbidden thread',
                  code: 'THREAD_FORBIDDEN',
                },
              },
            },
          },
        },
      },
    },
    '/api/models': {
      get: {
        tags: ['元信息'],
        summary: '模型列表',
        operationId: 'listModels',
        responses: {
          200: {
            description: '可用 mock 模型',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    models: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                example: {
                  models: [
                    {
                      id: 'mock-pro',
                      name: 'Mock Pro',
                      description: '全场景剧本，默认选择',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/providers': {
      get: {
        tags: ['Provider'],
        summary: '运行时注册的模型列表',
        description:
          '仅返回运行时经 POST /api/providers 注册的自定义模型（公开视图）。**响应绝不含 apiKey**（密钥只存服务端内存）。',
        operationId: 'listProviders',
        responses: {
          200: {
            description: '运行时注册项列表',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    providers: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ProviderOption' },
                    },
                  },
                  required: ['providers'],
                },
                example: {
                  providers: [
                    {
                      id: 'custom-1',
                      name: 'DeepSeek',
                      provider: 'openai-compat',
                      model: 'deepseek-chat',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Provider'],
        summary: '注册真实模型 Provider',
        description: [
          '把表单配置注册为带工具（时间 / 天气）与会话记忆的 Mastra Agent 模型，',
          '成功后出现在 `GET /api/models`，`POST /api/chat` 传 `model` 即可使用。',
          '\n\n- 注册不做上游连通性校验（惰性），首次对话才真连，失败走既有 error chunk',
          '\n- 服务端生成递增 id `custom-{n}`（进程内存，重启归零）',
          '\n- **apiKey 只进服务端内存：不落盘、不进日志、不进任何 GET 响应**',
        ].join(''),
        operationId: 'registerProvider',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProviderFormPayload',
              },
              example: {
                name: 'DeepSeek',
                provider: 'openai-compat',
                baseURL: 'https://api.deepseek.com/v1',
                apiKey: 'sk-your-api-key',
                model: 'deepseek-chat',
              },
            },
          },
        },
        responses: {
          201: {
            description: '注册成功，返回脱敏的 ProviderOption',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProviderOption' },
              },
            },
          },
          400: {
            description:
              '校验失败：name / apiKey / model 非空，openai-compat 时 baseURL 必填',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
                example: { error: 'apiKey is required' },
              },
            },
          },
        },
      },
    },
    '/api/providers/{id}': {
      put: {
        tags: ['Provider'],
        summary: '原位更新运行时注册的模型',
        description:
          '按完整表单覆盖更新指定 `custom-{n}` 模型：id 不变，重新组装 Mastra Agent（工具与记忆配置同 POST）。编辑场景使用——GET 列表回传的 baseURL 供表单预填。',
        operationId: 'updateProvider',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'custom-1',
            description: '注册时服务端生成的 id',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProviderFormPayload' },
              example: {
                name: 'DeepSeek',
                provider: 'openai-compat',
                baseURL: 'https://api.deepseek.com/v1',
                apiKey: 'sk-new-api-key',
                model: 'deepseek-reasoner',
              },
            },
          },
        },
        responses: {
          200: {
            description: '更新成功，返回脱敏的 ProviderOption',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProviderOption' },
              },
            },
          },
          400: {
            description: '校验失败（同 POST：name / apiKey / model 非空等）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'apiKey is required' },
              },
            },
          },
          404: { description: 'id 不存在' },
        },
      },
      delete: {
        tags: ['Provider'],
        summary: '删除运行时注册的模型',
        description:
          '从 registry 与运行时列表中移除指定 `custom-{n}` 模型。删除后历史会话再发送走既有 error chunk。',
        operationId: 'removeProvider',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'custom-1',
            description: '注册时服务端生成的 id',
          },
        ],
        responses: {
          200: {
            description: '删除成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ok: { type: 'boolean' } },
                  required: ['ok'],
                },
                example: { ok: true },
              },
            },
          },
          404: { description: 'id 不存在' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['认证'],
        summary: '注册新用户',
        description: [
          '邮箱 + 密码注册，成功即登录态（201 直接签发 access token，无需再登录）。',
          '\n\n- 密码长度 8-128 字符；邮箱需合法格式',
          '\n- IP 维度限流：每小时 5 次，超限 429',
          '\n- 该端点仅在 `AUTH_MODE=user` 时挂载（static 模式 404）',
        ].join(''),
        operationId: 'register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CredentialsPayload' },
              example: {
                email: 'demo@example.com',
                password: 'at-least-8-chars',
              },
            },
          },
        },
        responses: {
          201: {
            description: '注册成功，返回登录态（userId + access token）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokenResponse' },
              },
            },
          },
          400: {
            description: '邮箱格式不正确 / 密码长度不在 8-128 之间',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: '密码长度需在 8-128 字符之间' },
              },
            },
          },
          409: {
            description: '该邮箱已被注册',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: '该邮箱已被注册' },
              },
            },
          },
          429: {
            description: '注册限流（IP 维度每小时 5 次）',
            headers: {
              'retry-after': {
                schema: { type: 'integer' },
                description: '距限流窗口重置的秒数',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'Too Many Requests' },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['认证'],
        summary: '登录',
        description:
          '邮箱 + 密码登录，签发 15 分钟 access token（JWT）。失败一律返回「邮箱或密码错误」，不泄漏哪个字段错。仅在 `AUTH_MODE=user` 时挂载。',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CredentialsPayload' },
              example: {
                email: 'demo@example.com',
                password: 'at-least-8-chars',
              },
            },
          },
        },
        responses: {
          200: {
            description: '登录成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokenResponse' },
              },
            },
          },
          401: {
            description: '邮箱或密码错误',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: '邮箱或密码错误' },
              },
            },
          },
        },
      },
    },
    '/api/auth/keys': {
      post: {
        tags: ['认证'],
        summary: '签发 API Key',
        description: [
          '为当前用户签发程序化调用用的 API Key（`sk-aichat-` 前缀）。',
          '\n\n- **明文 key 只在本响应出现一次**：服务端只存哈希与展示前缀，丢了只能撤销重发',
          '\n- API Key 面向程序（长效），JWT 面向人（15 分钟）；两者同入口 `Authorization: Bearer`',
          '\n- 本端点只认 JWT（API Key 不能繁殖 key）',
        ].join(''),
        operationId: 'issueApiKey',
        security: [{ bearerAuth: [] }],
        responses: {
          201: {
            description: '签发成功（明文 key 只此一次）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyCreated' },
              },
            },
          },
          401: {
            description: '缺少有效 JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'Unauthorized' },
              },
            },
          },
        },
      },
    },
    '/api/auth/keys/{keyId}': {
      delete: {
        tags: ['认证'],
        summary: '撤销 API Key',
        description:
          '撤销自己的 API Key（下一秒全端点生效）。目标不存在或不属于当前用户返回 404。',
        operationId: 'revokeApiKey',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'keyId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: '签发时返回的 keyId',
          },
        ],
        responses: {
          204: { description: '撤销成功（无响应体）' },
          401: {
            description: '缺少有效 JWT',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'Unauthorized' },
              },
            },
          },
          404: {
            description: 'key 不存在或不属于当前用户',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: 'key 不存在或不属于当前用户' },
              },
            },
          },
        },
      },
    },
    '/api/workflows': {
      get: {
        tags: ['工作流'],
        summary: '工作流列表',
        description:
          '列出已注册的多 Agent 协作工作流（id + 描述）。未配置 MASTRA_MODEL（纯 mock 模式）返回空列表——前端据此落 mock 轨。',
        operationId: 'listWorkflows',
        responses: {
          200: {
            description: '工作流列表',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workflows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          description: { type: 'string' },
                        },
                        required: ['id', 'description'],
                      },
                    },
                  },
                  required: ['workflows'],
                },
                example: {
                  workflows: [
                    {
                      id: 'docs-pipeline-workflow',
                      description: '多步文档处理流水线',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/workflows/{id}/run': {
      post: {
        tags: ['工作流'],
        summary: '运行工作流（SSE 流式）',
        description: [
          '运行指定工作流，与 `POST /api/chat` **同线协议**：`event: chunk` 逐帧输出 StreamChunk，前端零改动复用渲染。',
          '\n\n- 工作流事件（步骤开始 / 委派 / 完成）映射为 text / thinking / tool_result 等 chunk 形态',
          '\n- 未配置 MASTRA_MODEL 时返回 404（提示配置后重启）',
        ].join(''),
        operationId: 'runWorkflow',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'docs-pipeline-workflow',
            description: '工作流 id（从列表获取）',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  task: { type: 'string', description: '任务描述（非空）' },
                },
                required: ['task'],
              },
              example: { task: '整理 Vue 组件库的发布流程文档' },
            },
          },
        },
        responses: {
          200: {
            description: 'SSE 流：与 /api/chat 同线协议，done 帧收尾',
            content: {
              'text/event-stream': {
                schema: { $ref: '#/components/schemas/StreamChunk' },
                example: [
                  'event: chunk\ndata: {"type":"thinking","content":"拆解任务步骤…"}',
                  'event: chunk\ndata: {"type":"text","content":"步骤一完成"}',
                  'event: chunk\ndata: {"type":"done","content":""}',
                ].join('\n\n'),
              },
            },
          },
          400: {
            description: 'task 缺失或为空',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: {
                  error:
                    'task 不能为空（body 需为 JSON：{ "task": "非空字符串" }）',
                },
              },
            },
          },
          404: {
            description: '工作流不存在，或未配置 MASTRA_MODEL',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
                example: { error: '未找到工作流：docs-pipeline' },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['元信息'],
        summary: '探活',
        operationId: 'health',
        responses: {
          200: {
            description: '服务在线',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string' } },
                  required: ['status'],
                },
                example: { status: 'ok' },
              },
            },
          },
        },
      },
    },
    '/api/vector/stats': {
      get: {
        tags: ['向量检索'],
        summary: '向量索引统计',
        description:
          '语义检索配置与索引状态。enabled=false 表示未配置 EMBEDDING_MODEL（纯关键词模式）；indexExists=false 表示已配置但索引未建（先跑 pnpm index:docs）。',
        operationId: 'vectorStats',
        responses: {
          200: {
            description: '索引统计',
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: {
                  enabled: true,
                  model: 'bge-m3',
                  url: 'http://localhost:11434/v1',
                  vector: {
                    engine: 'LibSQLVector',
                    location: 'docs-vector.db',
                  },
                  indexExists: true,
                  chunks: 471,
                  dimension: 1024,
                  metric: 'cosine',
                },
              },
            },
          },
        },
      },
    },
    '/api/vector/search': {
      post: {
        tags: ['向量检索'],
        summary: '双路对比检索',
        description:
          '同一查询跑两路：keyword（纯 TF-IDF 关键词基线）与 hybrid（语义向量 + 关键词 RRF 融合）。EMBEDDING_MODEL 未配置或向量路失败时 hybrid 降级为 keyword（degradedReason 带原因）。',
        operationId: 'vectorSearch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
              },
              example: { query: '怎么让组件库支持英文' },
            },
          },
        },
        responses: {
          200: {
            description: '两路检索结果',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          400: { description: 'query 缺失' },
        },
      },
    },
    '/api/vector/chunks': {
      get: {
        tags: ['向量检索'],
        summary: '向量库浏览（分页）',
        description:
          'node:sqlite 直读 docs-vector.db 的 docs_chunks 表，分页列出全部语义块（MastraVector 接口无全量 list，本地文件直查）。source 按文档精确过滤，q 对块文本做 LIKE 过滤。',
        operationId: 'vectorChunks',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: '页码，从 1 起',
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 50 },
            description: '每页块数（上限 50）',
          },
          {
            name: 'source',
            in: 'query',
            schema: { type: 'string' },
            example: 'guide/i18n.md',
            description: '按文档相对路径精确过滤',
          },
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string' },
            example: 'i18n',
            description: '块文本 LIKE 过滤（%q%）',
          },
        ],
        responses: {
          200: {
            description: '分页的语义块列表',
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: {
                  total: 473,
                  page: 1,
                  pageSize: 20,
                  chunks: [
                    {
                      id: 1,
                      source: 'components/attachments.md',
                      title: 'Attachments 系列',
                      text: '# Attachments 系列\n\n附件展示组件…',
                      chars: 297,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'AUTH_MODE=user 时：短时效 JWT（/api/auth/login 签发）或 API Key（sk-aichat- 前缀）；key 管理端点只认 JWT',
      },
    },
    schemas: {
      ErrorBody: {
        type: 'object',
        properties: {
          error: { type: 'string', description: '面向调用方的错误信息' },
          code: {
            type: 'string',
            description:
              '机器可读错误码（THREAD_FORBIDDEN / QUOTA_EXCEEDED 等，可选）',
          },
        },
        required: ['error'],
      },
      QuotaExceededBody: {
        type: 'object',
        description: '402 配额超额响应：引导升级而非报错',
        properties: {
          error: { type: 'string' },
          code: { type: 'string', const: 'QUOTA_EXCEEDED' },
          quota: { type: 'integer', description: '当前套餐的每日配额上限' },
          upgradeUrl: {
            type: 'string',
            description: '升级落地页（前端渲染升级卡片的跳转目标）',
          },
        },
        required: ['error', 'code', 'quota', 'upgradeUrl'],
      },
      CredentialsPayload: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            description: '明文密码（8-128 字符，仅在 HTTPS/本地环境传输）',
          },
        },
        required: ['email', 'password'],
      },
      AuthTokenResponse: {
        type: 'object',
        description: '注册（201）/ 登录（200）共用响应：新号即登录态',
        properties: {
          userId: { type: 'string' },
          email: { type: 'string' },
          accessToken: {
            type: 'string',
            description: 'JWT（HS256），默认 900 秒有效',
          },
          expiresIn: { type: 'integer', description: '有效期（秒）' },
        },
        required: ['userId', 'email', 'accessToken', 'expiresIn'],
      },
      ApiKeyCreated: {
        type: 'object',
        description: 'API Key 签发响应：明文 key 只出现这一次',
        properties: {
          keyId: { type: 'string', description: '撤销时使用的 id' },
          key: {
            type: 'string',
            description:
              'sk-aichat- 前缀明文 key（服务端只存哈希，丢失只能撤销重发）',
          },
          keyPrefix: {
            type: 'string',
            description: '展示前缀（如 sk-aichat-ab12），后台列表展示用',
          },
        },
        required: ['keyId', 'key', 'keyPrefix'],
      },
      ConversationSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' },
          messageCount: { type: 'integer' },
        },
        required: ['id', 'title', 'description', 'updatedAt', 'messageCount'],
      },
      ConversationDetail: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' },
          messageCount: { type: 'integer' },
          messages: {
            type: 'array',
            items: { $ref: '#/components/schemas/ChatMessage' },
          },
        },
        required: ['id', 'title', 'updatedAt', 'messages'],
      },
      ChatMessage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string', description: 'Markdown 正文' },
          thinking: {
            type: 'object',
            description: '思维链（种子历史里为已完成态，含耗时）',
            properties: {
              content: { type: 'string' },
              duration: { type: 'integer', description: '思考耗时（毫秒）' },
            },
          },
          toolCalls: {
            type: 'array',
            items: { $ref: '#/components/schemas/ToolCall' },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'role', 'content', 'createdAt'],
      },
      ToolCall: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          arguments: { type: 'object', additionalProperties: true },
          result: { description: '工具结果（任意 JSON）' },
          status: { type: 'string', enum: ['calling', 'completed', 'error'] },
          duration: { type: 'integer' },
        },
        required: ['id', 'name', 'arguments', 'status'],
      },
      ProviderOption: {
        type: 'object',
        description:
          '运行时注册项的公开视图（脱敏：无 apiKey；baseURL 非密钥，编辑表单预填需要回传）',
        properties: {
          id: { type: 'string', example: 'custom-1' },
          name: { type: 'string', example: 'DeepSeek' },
          provider: { type: 'string', enum: ['openai-compat', 'anthropic'] },
          model: { type: 'string', example: 'deepseek-chat' },
          baseURL: {
            type: 'string',
            example: 'https://api.deepseek.com/v1',
            description: 'openai-compat 注册时的端点（编辑预填用）',
          },
        },
        required: ['id', 'name', 'provider'],
      },
      ProviderFormPayload: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '展示名（必填）' },
          provider: {
            type: 'string',
            enum: ['openai-compat', 'anthropic'],
            description: '协议类型（必填）',
          },
          baseURL: {
            type: 'string',
            description: 'openai-compat 必填；anthropic 缺省走官方端点',
            example: 'https://api.deepseek.com/v1',
          },
          apiKey: {
            type: 'string',
            description: '密钥（必填）：仅服务端内存持有，任何响应不回显',
          },
          model: { type: 'string', description: '模型名（必填）' },
        },
        required: ['name', 'provider', 'apiKey', 'model'],
      },
      ChatRequestBody: {
        type: 'object',
        properties: {
          conversationId: {
            type: 'string',
            description: '会话 id；提供时这轮对话会写回该会话历史',
            example: 'conv_vue',
          },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                content: {
                  description:
                    '消息正文：字符串，或 OpenAI 兼容 parts 数组（user 消息多模态：text + image_url base64/URL 图片）',
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'array',
                      items: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              type: { const: 'text' },
                              text: { type: 'string' },
                            },
                          },
                          {
                            type: 'object',
                            properties: {
                              type: { const: 'image_url' },
                              image_url: {
                                type: 'object',
                                properties: { url: { type: 'string' } },
                                required: ['url'],
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              required: ['role', 'content'],
            },
          },
          model: { type: 'string', description: '模型 id，见 GET /api/models' },
          speed: {
            type: 'number',
            description: '速度倍率：1 正常，<1 加速，>1 更慢（0 用于测试）',
            default: 1,
          },
        },
        required: ['messages'],
      },
      StreamChunk: {
        type: 'object',
        description: '与 @toimc/core 的 StreamChunk 同构',
        properties: {
          type: {
            type: 'string',
            enum: [
              'text',
              'thinking',
              'tool_call',
              'tool_result',
              'error',
              'done',
            ],
          },
          content: { type: 'string' },
          metadata: {
            type: 'object',
            description:
              'tool_call / tool_result 携带的工具元信息；done 帧携带 usage',
            properties: {
              toolCallId: { type: 'string' },
              toolName: { type: 'string' },
              toolArguments: { type: 'object', additionalProperties: true },
              toolResult: {},
              toolError: { type: 'string' },
              duration: { type: 'integer' },
              usage: {
                type: 'object',
                description:
                  'done 帧回传的本轮 token 用量（mock 估算与真实模型回传均携带）',
                properties: {
                  inputTokens: { type: 'integer' },
                  outputTokens: { type: 'integer' },
                },
              },
            },
          },
        },
        required: ['type', 'content'],
      },
    },
  },
} as const
