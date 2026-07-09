import type { Provider, GenerateParams } from './types'

export const geminiProvider: Provider = {
  id: 'gemini',
  label: 'Gemini (Google)',
  defaultModel: 'gemini-2.0-flash',
  models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],

  async complete({ apiKey, model, systemPrompt, userMessage }: GenerateParams): Promise<string> {
    // ⚠️ Gemini는 키를 URL 쿼리스트링에 싣는다. 로그/에러에 URL 전체를 남기지 말 것.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      // 키가 URL에 있으므로 status만 노출
      throw new Error(`Gemini API 오류 (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    return parts.map((p: any) => p.text ?? '').join('')
  },
}
