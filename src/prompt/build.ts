import { DEFAULT_SKELETON } from './skeleton'
import { MODE_FORMULAS, MODES, type Mode } from './modes'

// 프롬프트 조립기.
//
// mode === 특정 모드  → 그 모드 공식만 주입 (MVP 2단계: 적용 모드 고정)
// mode === 'auto'     → 모델이 스스로 판별 + 4개 공식 모두 제공 (6단계)
//
// skeleton은 설정 화면에서 사용자가 덮어쓴 값이 있으면 그걸 넘겨받는다.
export function buildSystemPrompt(
  mode: Mode | 'auto',
  skeleton: string = DEFAULT_SKELETON,
): string {
  let modeSection: string

  if (mode === 'auto') {
    const allFormulas = MODES.map((m) => MODE_FORMULAS[m]).join('\n\n')
    modeSection = `# 1단계 — 모드 판별
먼저 이 글을 읽은 독자의 목적이 아래 4가지 중 무엇에 가장 가까운지
판단하라. 판단한 모드를 출력 JSON의 mode 필드에 넣어라.
- 적용: 배워서 써먹는 글 (기술·개념·튜토리얼·방법론·레시피)
- 검증: 사실을 전달하는 글 (뉴스·보도·발표)
- 논증: 설득하려는 글 (칼럼·사설·주장)
- 소화: 읽고 음미하는 글 (에세이·교양·서사)

# 2단계 — 질문 생성
판별한 모드에 해당하는 아래 공식에 따라 질문 2개를 만든다.

${allFormulas}`
  } else {
    modeSection = `# 질문 생성
이 글은 "${mode}" 모드로 다룬다. 아래 공식에 따라 질문 2개를 만든다.
출력 JSON의 mode 필드에는 "${mode}"를 넣어라.

${MODE_FORMULAS[mode]}`
  }

  return skeleton.replace('{{MODE_SECTION}}', modeSection)
}

// 실제 API에 보낼 user 메시지: 본문 텍스트.
// (본문이 너무 길면 앞부분만 — 토큰 절약. 임계값은 튜닝 대상)
export function buildUserMessage(articleText: string, maxChars = 12000): string {
  const trimmed =
    articleText.length > maxChars
      ? articleText.slice(0, maxChars) + '\n\n...(이하 생략)'
      : articleText
  return `다음은 사용자가 방금 읽은 글의 본문이다:\n\n"""\n${trimmed}\n"""`
}
