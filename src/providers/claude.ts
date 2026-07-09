import type { Provider, GenerateParams } from './types'

export const claudeProvider: Provider = {
  id: 'claude',
  label: 'Claude (Anthropic)',
  defaultModel: 'claude-sonnet-4-6',
  models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],

  async complete({ apiKey, model, systemPrompt, userMessage }: GenerateParams): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // ⚠️ 브라우저 직접 호출 필수 헤더. 없으면 CORS 에러.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API 오류 (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    // content 블록 중 text 타입만 모아서 반환
    const text = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
    return text
  },
}
