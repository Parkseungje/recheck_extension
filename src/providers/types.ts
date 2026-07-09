import type { Mode } from '../prompt/modes'

export type ProviderId = 'claude' | 'openai' | 'gemini'

export interface GenerateParams {
  apiKey: string
  model: string
  systemPrompt: string
  userMessage: string
}

// 전략 패턴의 핵심: 각 provider는 "본문 텍스트 하나"를 반환하도록 정규화한다.
// 세 API의 요청/응답 형태 차이는 각 구현체 안에 갇힌다.
export interface Provider {
  id: ProviderId
  label: string
  defaultModel: string
  models: string[]
  // 모델의 원시 텍스트 응답을 반환 (JSON 문자열이어야 함)
  complete(params: GenerateParams): Promise<string>
}

// ---- 최종 정규화 결과 (UI가 소비하는 형태) ----

export interface Question {
  question: string
  hints: string[]
  anchor: string
}

export interface QuestionSet {
  mode: Mode | string
  questions: Question[]
}

// 모델 응답(JSON 문자열)을 QuestionSet으로 파싱.
// provider마다 코드펜스를 붙이는 등 오염이 있으므로 방어적으로 처리한다.
export function parseQuestionSet(raw: string): QuestionSet {
  let text = raw.trim()

  // 코드펜스 제거 (```json ... ``` 또는 ``` ... ```)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) text = fence[1].trim()

  // 앞뒤 잡텍스트가 있으면 첫 { 부터 마지막 } 까지만 취함
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1)
  }

  let data: any
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('모델 응답을 JSON으로 파싱하지 못했습니다. (프롬프트 튜닝 필요)')
  }

  if (!data || !Array.isArray(data.questions)) {
    throw new Error('응답에 questions 배열이 없습니다.')
  }

  // 최소한의 형태 보정
  const questions: Question[] = data.questions.slice(0, 2).map((q: any) => ({
    question: String(q?.question ?? '').trim(),
    hints: Array.isArray(q?.hints) ? q.hints.slice(0, 3).map((h: any) => String(h).trim()) : [],
    anchor: String(q?.anchor ?? '').trim(),
  }))

  return { mode: data.mode ?? '알 수 없음', questions }
}
