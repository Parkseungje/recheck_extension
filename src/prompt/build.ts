import { DEFAULT_SKELETON } from './skeleton'
import { MODE_FORMULAS, MODES, type Mode } from './modes'

export const MAX_ARTICLE_CHARS = 12000

export function buildSystemPrompt(
  mode: Mode | 'auto',
  language: string,
  count: number,
  skeleton: string = DEFAULT_SKELETON,
): string {
  let modeSection: string

  if (mode === 'auto') {
    const allFormulas = MODES.map((m) => MODE_FORMULAS[m]).join('\n\n')
    modeSection = `# 1단계: 모드 판별
먼저 사용자가 읽은 글의 목적이 아래 4가지 중 어디에 가장 가까운지 판단한다.
판단한 모드는 출력 JSON의 mode 필드에 넣는다.

- 적용: 배운 것을 써먹으려는 글. 기술, 개념, 튜토리얼, 방법론.
- 검증: 사실을 판단하려는 글. 뉴스, 보도, 발표.
- 논증: 설득하려는 글. 칼럼, 사설, 주장.
- 소화: 읽고 따라가야 하는 글. 에세이, 교양, 서사.

# 2단계: 질문 생성
판별한 모드의 공식에 따라 질문 ${count}개를 만든다.

${allFormulas}`
  } else {
    modeSection = `# 질문 생성
이 글은 "${mode}" 모드로 다룬다.
아래 공식에 따라 질문 ${count}개를 만든다.
출력 JSON의 mode 필드에는 "${mode}"를 넣는다.

${MODE_FORMULAS[mode]}`
  }

  return skeleton
    .replace('{{MODE_SECTION}}', modeSection)
    .replace('{{LANGUAGE}}', language)
    .replaceAll('{{COUNT}}', String(count))
}

export function buildUserMessage(articleText: string, maxChars = MAX_ARTICLE_CHARS): string {
  const trimmed =
    articleText.length > maxChars
      ? `${articleText.slice(0, maxChars)}\n\n...(이하 생략)`
      : articleText

  return `다음은 사용자가 방금 읽은 글의 본문이다:\n\n"""\n${trimmed}\n"""`
}
