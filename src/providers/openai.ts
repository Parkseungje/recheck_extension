import type { Provider, GenerateParams } from './types'

export const openaiProvider: Provider = {
  id: 'openai',
  label: 'GPT (OpenAI)',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],

  async complete({ apiKey, model, systemPrompt, userMessage }: GenerateParams): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        // JSON 출력 강제 (지원 모델 한정). 파서가 방어하므로 실패해도 치명적이지 않음.
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API 오류 (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  },
}
