import {
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability'

/**
 * Studio 线（src/mastra/index.ts）的可观测性装配：traces + logs 落地
 * 本地 LibSQL 库（composite storage 的 observability 域，见 memory.ts），
 * Studio 的 Observability 视图直接读同一份库。仅 Studio 线消费——网关线
 * （8787 裸 Agent）明确不接入（spec 17 非目标）。
 */
export function createObservability(): Observability {
  return new Observability({
    configs: {
      default: {
        serviceName: 'dev-server',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
        logging: { enabled: true, level: 'info' },
      },
    },
  })
}
