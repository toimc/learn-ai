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
    version: '0.1.0',
    description: [
      '本地 mock 服务端：为组件库 Playground 与文档站提供多会话数据源与 SSE 流式响应。',
      runNote,
      '\n\n**SSE 线格式**：`POST /api/chat` 的每个事件为 `event: chunk` + `data: <StreamChunk JSON>`，',
      '与 `@toimc/core` 的 `StreamChunk` 同构（text / thinking / tool_call / tool_result / error / done）。',
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
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'SSE 流：每个事件为 `event: chunk`，data 为 StreamChunk JSON，最后一块 type=done',
            content: {
              'text/event-stream': {
                schema: { $ref: '#/components/schemas/StreamChunk' },
                example: [
                  'event: chunk\ndata: {"type":"thinking","content":"先把问题拆开…"}',
                  'event: chunk\ndata: {"type":"text","content":"流式回复正文"}',
                  'event: chunk\ndata: {"type":"done","content":""}',
                ].join('\n\n'),
              },
            },
          },
          400: { description: 'messages 缺失或为空' },
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
    '/vector/stats': {
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
    '/vector/search': {
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
    '/vector/chunks': {
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
    schemas: {
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
        description: '运行时注册项的公开视图（脱敏：无 apiKey / baseURL）',
        properties: {
          id: { type: 'string', example: 'custom-1' },
          name: { type: 'string', example: 'DeepSeek' },
          provider: { type: 'string', enum: ['openai-compat', 'anthropic'] },
          model: { type: 'string', example: 'deepseek-chat' },
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
                content: { type: 'string' },
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
            description: 'tool_call / tool_result 携带的工具元信息',
            properties: {
              toolCallId: { type: 'string' },
              toolName: { type: 'string' },
              toolArguments: { type: 'object', additionalProperties: true },
              toolResult: {},
              toolError: { type: 'string' },
              duration: { type: 'integer' },
            },
          },
        },
        required: ['type', 'content'],
      },
    },
  },
} as const
