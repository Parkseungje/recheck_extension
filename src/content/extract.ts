import { Readability } from '@mozilla/readability'

// 사이드패널이 보내는 EXTRACT 메시지에만 반응한다.
// 평소엔 아무 일도 하지 않는다. (자동 전송 없음 — 프라이버시)
export interface ExtractResult {
  ok: boolean
  title?: string
  text?: string
  url?: string
  error?: string
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'EXTRACT') return

  try {
    // 원본 DOM을 건드리지 않도록 clone 후 파싱
    const docClone = document.cloneNode(true) as Document
    const article = new Readability(docClone).parse()

    if (!article || !article.textContent?.trim()) {
      sendResponse({ ok: false, error: '이 페이지에서 본문을 찾지 못했습니다.' } as ExtractResult)
      return
    }

    sendResponse({
      ok: true,
      title: article.title ?? document.title,
      text: article.textContent.trim(),
      url: location.href,
    } as ExtractResult)
  } catch (e: any) {
    sendResponse({ ok: false, error: e?.message ?? '본문 추출 중 오류' } as ExtractResult)
  }

  // 동기 응답이므로 return true 불필요 (비동기면 true 반환 필요)
})
