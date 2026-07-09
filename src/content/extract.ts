import { Readability } from '@mozilla/readability'

// 사이드패널이 보내는 EXTRACT 메시지에만 반응한다.
// 평소엔 아무 일도 하지 않는다. (자동 전송 없음 — 프라이버시)
export interface ExtractResult {
  ok: boolean
  title?: string
  text?: string
  url?: string
  isSelection?: boolean // 사용자가 드래그로 고른 영역인지 (전체 본문이 아니라)
  // 실패 사유 코드. UI(사이드패널)에서 언어에 맞게 번역해 보여준다.
  code?: 'NO_ACTIVE_TAB' | 'CANT_READ' | 'NO_ARTICLE' | 'EXTRACT_ERROR'
}

// 본문 텍스트 추출.
// 1순위: Readability (광고·메뉴 제거된 정제 본문).
// 단, namu.wiki처럼 표·접기박스로 문단이 쪼개진 페이지에선 Readability가
// 본문을 크게 놓치므로, 컨테이너 렌더 텍스트가 훨씬 길면 그걸 본문으로 쓴다.
// (파악용 글자수 계산과 실제 전송이 같은 로직을 쓰도록 여기서 단일화)
function extractBody(): { title: string; text: string } {
  let readabilityText = ''
  let title = document.title
  try {
    const article = new Readability(document.cloneNode(true) as Document).parse()
    if (article?.textContent) {
      readabilityText = article.textContent.trim()
      if (article.title) title = article.title
    }
  } catch {
    // Readability 실패 — 아래 컨테이너 텍스트로 폴백
  }

  const container: HTMLElement =
    (document.querySelector('main') as HTMLElement | null) ??
    (document.querySelector('article') as HTMLElement | null) ??
    (document.querySelector('[role="main"]') as HTMLElement | null) ??
    document.body
  const containerText = (container.innerText ?? container.textContent ?? '').trim()

  // Readability가 컨테이너 텍스트의 절반도 못 뽑았으면(위키형) 컨테이너 텍스트 채택
  const text =
    readabilityText.length >= containerText.length * 0.5 ? readabilityText : containerText
  return { title, text }
}

// 선언형 주입(페이지 로드 시)과 사이드패널의 프로그램 주입이 겹칠 수 있으므로
// 리스너는 한 번만 등록한다. (중복 시 EXTRACT 응답이 두 번 나가는 문제 방지)
declare global {
  interface Window {
    __recheckContentReady?: boolean
  }
}

if (!window.__recheckContentReady) {
  window.__recheckContentReady = true

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // 드래그 안 했을 때 보여줄 "본문 전체 글자수" 조회. (선택과 무관)
    if (msg?.type === 'ARTICLE_INFO') {
      try {
        sendResponse({ length: extractBody().text.length })
      } catch {
        sendResponse({ length: 0 })
      }
      return
    }

    if (msg?.type !== 'EXTRACT') return

    try {
      // 드래그로 선택한 텍스트가 있으면 그 부분만 보낸다. (긴 글에서 원하는 부분만)
      const selected = window.getSelection()?.toString().trim() ?? ''
      if (selected) {
        sendResponse({
          ok: true,
          title: document.title,
          text: selected,
          url: location.href,
          isSelection: true,
        } as ExtractResult)
        return
      }

      // 선택이 없으면 본문 전체를 추출한다. (파악용과 동일한 로직)
      const body = extractBody()
      if (!body.text) {
        sendResponse({ ok: false, code: 'NO_ARTICLE' } as ExtractResult)
        return
      }

      sendResponse({
        ok: true,
        title: body.title,
        text: body.text,
        url: location.href,
      } as ExtractResult)
    } catch {
      sendResponse({ ok: false, code: 'EXTRACT_ERROR' } as ExtractResult)
    }

    // 동기 응답이므로 return true 불필요 (비동기면 true 반환 필요)
  })

  // 선택 영역 글자수를 사이드패널에 실시간으로 알린다.
  // 페이지에는 아무것도 그리지 않으며(개입 없음), 패널이 닫혀 있으면
  // 받는 쪽이 없어 메시지는 조용히 실패한다.
  // 긴 글을 통째로 드래그할 때 toString()이 매 이벤트마다 도는 걸 막으려
  // requestAnimationFrame으로 한 프레임에 한 번만 측정한다.
  let selectionMeasurePending = false
  document.addEventListener('selectionchange', () => {
    if (selectionMeasurePending) return
    selectionMeasurePending = true
    requestAnimationFrame(() => {
      selectionMeasurePending = false
      // 확장이 리로드/업데이트되면 이 content script의 컨텍스트가 무효화된다.
      // 그 상태에서 chrome API 호출은 동기 예외("Extension context invalidated")를
      // 던지므로(= .catch로 못 잡음), 호출 전에 컨텍스트 유효성을 확인하고 감싼다.
      if (!chrome.runtime?.id) return
      const length = window.getSelection()?.toString().trim().length ?? 0
      try {
        chrome.runtime.sendMessage({ type: 'SELECTION_LENGTH', length }).catch(() => {})
      } catch {
        // 컨텍스트 무효화 — 페이지 새로고침 전까지는 조용히 무시
      }
    })
  })
}
