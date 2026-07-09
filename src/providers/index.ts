import type { Provider, ProviderId } from './types'
import { claudeProvider } from './claude'
import { openaiProvider } from './openai'
import { geminiProvider } from './gemini'

export const PROVIDERS: Record<ProviderId, Provider> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
}

export function getProvider(id: ProviderId): Provider {
  const p = PROVIDERS[id]
  if (!p) throw new Error(`알 수 없는 provider: ${id}`)
  return p
}

export * from './types'
