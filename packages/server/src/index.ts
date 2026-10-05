export type {
  AssistantResultMessage,
  ChatCompletionResult,
  ChatRequestBody,
  ChatUsage,
  GatewayAuthOptions,
  GatewayChatOptions,
  GatewayCorsOptions,
  GatewayMiddleware,
  GatewayOptions,
  GatewayRateLimitOptions,
} from './types'
export { createChatGateway } from './create-gateway'
export { createChatRoutes } from './routes/chat'
export type { ChatRoutesDeps } from './routes/chat'
export { createModelsRoutes } from './routes/models'
export { createHealthRoutes } from './routes/health'
export { bearerAuth } from './middleware/auth'
export { rateLimit } from './middleware/rate-limit'
export type {
  ApiKeyRecord,
  GatewayEnv,
  GatewayIdentityOptions,
  IdentityStore,
  UsageInsert,
  UsageRecord,
  UserPlan,
  UserRecord,
} from './identity/types'
export { EmailTakenError } from './identity/types'
export {
  API_KEY_PREFIX,
  issueApiKey,
  sha256,
  verifyApiKey,
} from './identity/api-key'
export { hashPassword, verifyPassword } from './identity/password'
export { identifyUser, requireJwt } from './identity/identify-user'
export {
  DEFAULT_DAILY_QUOTA,
  QUOTA_EXCEEDED_CODE,
  UPGRADE_URL,
  quotaGuard,
} from './identity/quota-guard'
export { createIdentityRoutes } from './identity/routes'
export type { IdentityRoutesOptions } from './identity/routes'
