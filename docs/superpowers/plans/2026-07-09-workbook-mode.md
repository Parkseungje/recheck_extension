# 문제집형(근거+이동) 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 질문을 "원문 근거 문단을 이해하면 답할 수 있는" 독해 문제집형으로 바꾸고, 각 질문에서 근거 문단으로 스크롤·하이라이트 이동하는 "원문에서 확인" 버튼을 추가한다.

**Architecture:** ① 프롬프트(modes/skeleton)를 근거형으로 재작성하고 질문 스키마의 `source_pointer`를 `anchor`(원문 그대로 복사한 구절)로 교체. ② content script가 `SCROLL_TO` 메시지로 그 구절을 `window.find`로 찾아 스크롤하고 CSS Custom Highlight API로 노란 하이라이트(3초 후 해제). ③ 패널이 질문마다 "원문에서 확인" 버튼을 띄우고 클릭 시 활성 탭에 `SCROLL_TO`를 보낸다.

**Tech Stack:** Vue 3 + TypeScript + Vite(CRXJS), `@mozilla/readability`, Chrome MV3 (side panel, content script), CSS Custom Highlight API.

## Global Constraints

- 검증 게이트: 이 저장소엔 테스트 러너가 없다. 각 태스크는 **`npm run build`(vue-tsc 타입체크 + vite build) 통과 + 명시된 수동 확인**으로 검증한다. 새 테스트 프레임워크를 추가하지 않는다.
- content script(`extract.ts`)를 바꾼 태스크는 수동 확인 전에 **① chrome://extensions에서 확장 리로드 → ② 대상 탭 새로고침(F5)** 을 반드시 먼저 한다. (열려 있던 탭엔 옛 스크립트가 남기 때문)
- AI는 답·설명·사실 단정을 하지 않는다(기존 안전 규칙 유지). `anchor`는 "정답"이 아니라 "원문 위치"다.
- 질문 정확히 2개, 힌트 정확히 3개, UI 선택 언어로 작성(기존 규칙 유지).
- `anchor`는 원문에서 **한 글자도 바꾸지 않고 연속으로 복사한 15~40자 구절**.
- 커밋은 사용자가 요청할 때만 한다(각 태스크의 커밋 스텝은 사용자 승인 시 실행).
- 기존 코드 스타일(주석 밀도·네이밍) 따름. 요청과 무관한 리팩터링 금지.

---

## File Structure

- `src/providers/types.ts` — `Question` 스키마: `source_pointer` → `anchor`. `parseQuestionSet` 매핑.
- `src/prompt/modes.ts` — `MODE_FORMULAS` 4개를 근거형으로 재작성.
- `src/prompt/skeleton.ts` — 근거 규칙 추가, `source_pointer` 섹션·출력 JSON을 `anchor`로 교체.
- `src/content/extract.ts` — `SCROLL_TO` 처리 + `window.find` 검색 + CSS Highlight.
- `src/sidepanel/App.vue` — 질문 카드에 "원문에서 확인" 버튼·클릭 핸들러·"못 찾음" 폴백. (Task 1에서 기존 `source_pointer` 렌더 제거)
- `src/i18n.ts` — `openInSource`, `notFoundInSource` × 8개 언어.

---

## Task 1: 근거형 프롬프트 + `anchor` 스키마

**Files:**
- Modify: `src/providers/types.ts` (Question 인터페이스, parseQuestionSet)
- Modify: `src/prompt/modes.ts` (MODE_FORMULAS)
- Modify: `src/prompt/skeleton.ts` (규칙 + 출력 형식)
- Modify: `src/sidepanel/App.vue` (기존 source_pointer 렌더 `<p>` 제거 — 빌드 그린 유지)

**Interfaces:**
- Produces: `Question { question: string; hints: string[]; anchor: string }` — Task 3의 버튼이 `q.anchor`를 사용.
- Produces: `buildSystemPrompt(mode, language, skeleton?)` 시그니처는 그대로. 출력 JSON에 `anchor` 포함.

- [ ] **Step 1: `types.ts` — Question 스키마 교체**

`src/providers/types.ts`의 `Question` 인터페이스:

```ts
export interface Question {
  question: string
  hints: string[]
  anchor: string
}
```

`parseQuestionSet` 안의 매핑에서 `source_pointer` 줄을 교체:

```ts
  const questions: Question[] = data.questions.slice(0, 2).map((q: any) => ({
    question: String(q?.question ?? '').trim(),
    hints: Array.isArray(q?.hints) ? q.hints.slice(0, 3).map((h: any) => String(h).trim()) : [],
    anchor: String(q?.anchor ?? '').trim(),
  }))
```

- [ ] **Step 2: `modes.ts` — 4개 공식 근거형 재작성**

`src/prompt/modes.ts`의 `MODE_FORMULAS` 전체를 교체:

```ts
export const MODE_FORMULAS: Record<Mode, string> = {
  적용: `[적용 모드 공식]
1. 글의 핵심 개념 하나를 고른다.
2. 그 개념이 성립하는 "조건"을 원문에서 찾아 짚게 하는 질문을 만든다.
3. anchor는 그 조건이 적힌 문단에서 원문 그대로 복사한 구절로 잡는다.`,

  검증: `[검증 모드 공식]
1. 글의 핵심 "사실 주장" 하나를 고른다.
2. 그 주장의 함의(누구에게 어떤 영향이 가는지)를 원문 근거로 확인하게 하는 질문을 만든다.
3. anchor는 그 주장이 담긴 문단에서 원문 그대로 복사한 구절로 잡는다.`,

  논증: `[논증 모드 공식]
1. 글쓴이의 핵심 "주장"과 그 "근거"를 원문에서 짚게 하는 질문을 만든다.
2. anchor는 그 주장·근거가 담긴 문단에서 원문 그대로 복사한 구절로 잡는다.`,

  소화: `[소화 모드 공식]
1. 핵심 문단을 독자 "자신의 말"로 재구성하게 하는 질문을 만든다.
2. anchor는 그 핵심 문단에서 원문 그대로 복사한 구절로 잡는다.`,
}
```

- [ ] **Step 3: `skeleton.ts` — source_pointer 섹션을 anchor로 교체**

`src/prompt/skeleton.ts`의 `## source_pointer (각 질문마다)` 섹션 블록을 교체:

```
## anchor (각 질문마다)
- 질문의 근거가 되는 문단에서 원문을 한 글자도 바꾸지 말고 연속으로 복사한
  15~40자 구절을 넣는다. 사용자가 이 구절로 원문 위치를 찾아 이동한다.
- 요약·의역·생략 금지. 반드시 원문에 그대로 존재하는 문자열이어야 한다.
```

- [ ] **Step 4: `skeleton.ts` — 근거 규칙 추가**

`# 절대 규칙 (위반 시 실패)` 목록에 두 줄 추가(질문 개수 규칙 위쪽 등 적당한 위치):

```
- 질문은 반드시 anchor로 지목한 문단을 이해하면 답할 수 있어야 한다.
  원문에 근거가 없는 추측·상상 질문 금지.
- 글의 중심 내용을 다루는 문단을 고른다. 지엽적·부차적 문단 금지.
```

- [ ] **Step 5: `skeleton.ts` — 출력 JSON 형식의 source_pointer를 anchor로 교체**

`# 출력 형식` 아래 JSON 예시 두 객체의 `"source_pointer": "..."`를 `"anchor": "..."`로 교체:

```
{
  "mode": "적용 | 검증 | 논증 | 소화",
  "questions": [
    { "question": "...", "hints": ["...","...","..."], "anchor": "..." },
    { "question": "...", "hints": ["...","...","..."], "anchor": "..." }
  ]
}
```

- [ ] **Step 6: `App.vue` — 기존 source_pointer 렌더 제거 (빌드 그린 유지)**

`src/sidepanel/App.vue` 결과 렌더에서 아래 줄을 삭제한다(Task 3에서 버튼으로 대체):

```html
        <p v-else class="pointer">📄 {{ q.source_pointer }}</p>
```

삭제 후 힌트 버튼 블록은 `v-if="(openHints[i] ?? 0) < q.hints.length"`만 남고 `v-else`가 없어진다. (정상)

- [ ] **Step 7: 빌드 검증**

Run: `npm run build`
Expected: 에러 없이 빌드 성공(`✓ built`). 특히 `q.source_pointer` 참조가 남아 있으면 vue-tsc가 실패하므로, 성공 = 참조 제거 완료.

- [ ] **Step 8: 수동 확인**

`chrome://extensions`에서 확장 리로드 → 아무 기사 페이지 F5 → 패널에서 생성. 질문이 원문 문단 기반으로 나오는지, 콘솔에서 `parseQuestionSet` 결과에 `anchor`가 채워지는지 확인(필요 시 App.vue generate에 `console.log(parsed)` 임시 삽입 후 제거).

- [ ] **Step 9: (승인 시) 커밋**

```bash
git add src/providers/types.ts src/prompt/modes.ts src/prompt/skeleton.ts src/sidepanel/App.vue
git commit -m "feat: 근거형 질문 프롬프트 + anchor 스키마로 전환"
```

---

## Task 2: content script — `SCROLL_TO` 검색·하이라이트

**Files:**
- Modify: `src/content/extract.ts` (onMessage에 SCROLL_TO 분기, 하이라이트 함수, 스타일 1회 주입)

**Interfaces:**
- Consumes: 패널이 보내는 `{ type: 'SCROLL_TO', text: string }`.
- Produces: sendResponse `{ found: boolean }`. Task 3이 `found`로 폴백 판단.

- [ ] **Step 1: 하이라이트 스타일 1회 주입 + 하이라이트 함수 추가**

`src/content/extract.ts`에서 가드 블록(`if (!window.__recheckContentReady) {`) 안, `chrome.runtime.onMessage.addListener` **앞**에 아래를 추가:

```ts
  // ::highlight() 렌더용 스타일 1회 주입 (본문 DOM은 건드리지 않음)
  const highlightStyle = document.createElement('style')
  highlightStyle.textContent = `::highlight(recheck-anchor){ background-color:#fde047; color:inherit; }`
  document.head.appendChild(highlightStyle)

  let highlightTimer: number | undefined

  // anchor 구절을 찾아 스크롤 + 노란 하이라이트(3초). 성공 시 true.
  function highlightAnchor(query: string): boolean {
    const text = query.trim()
    if (!text) return false

    const selection = window.getSelection()
    selection?.removeAllRanges()
    // window.find: 렌더 텍스트에서 매칭 + 화면으로 스크롤 (Chrome 지원)
    const found = (window as unknown as { find: (...args: unknown[]) => boolean }).find(
      text, false, false, true, false, false, false,
    )
    if (!found) return false

    const range =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    selection?.removeAllRanges()
    if (!range) return true // 스크롤은 됐으나 range 확보 실패 — 하이라이트만 생략

    const cssHighlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HighlightCtor = (window as unknown as { Highlight?: new (r: Range) => unknown }).Highlight
    if (!cssHighlights || !HighlightCtor) return true // 하이라이트 미지원 → 스크롤만

    cssHighlights.set('recheck-anchor', new HighlightCtor(range))
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => cssHighlights.delete('recheck-anchor'), 3000)
    return true
  }
```

- [ ] **Step 2: onMessage에 SCROLL_TO 분기 추가**

`chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {` 본문에서 `ARTICLE_INFO` 분기 **앞**에 추가:

```ts
    // 특정 구절로 스크롤 + 하이라이트
    if (msg?.type === 'SCROLL_TO') {
      sendResponse({ found: highlightAnchor(String(msg.text ?? '')) })
      return
    }
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공. 타입 단언(`as unknown as ...`)로 `window.find`/`CSS.highlights`/`Highlight` 접근 시 타입 에러 없음.

- [ ] **Step 4: 수동 확인**

확장 리로드 → 기사 페이지 F5 → DevTools 콘솔에서 실제 본문의 한 구절로 직접 메시지 전송:

```js
chrome.runtime.sendMessage // (패널 컨텍스트에서) — 대신 페이지에서 아래로 테스트:
```

패널 DevTools 콘솔(사이드패널 우클릭 → 검사)에서:

```js
const [t] = await chrome.tabs.query({active:true,currentWindow:true})
await chrome.tabs.sendMessage(t.id, { type:'SCROLL_TO', text:'<본문에 실제로 있는 구절>' })
```

Expected: 페이지가 해당 구절로 스크롤되고 노란 하이라이트가 잠깐 뜬 뒤 3초 후 사라짐. 반환값 `{found:true}`. 없는 구절이면 `{found:false}`.

- [ ] **Step 5: (승인 시) 커밋**

```bash
git add src/content/extract.ts
git commit -m "feat: content script anchor 스크롤·하이라이트(SCROLL_TO)"
```

---

## Task 3: 패널 "원문에서 확인" 버튼 + i18n + 폴백

**Files:**
- Modify: `src/i18n.ts` (Messages 인터페이스 + 8개 로케일)
- Modify: `src/sidepanel/App.vue` (버튼, 클릭 핸들러, 폴백 표시, 스타일)

**Interfaces:**
- Consumes: `Question.anchor` (Task 1), content script `{ found }` (Task 2), `t.openInSource`/`t.notFoundInSource`.

- [ ] **Step 1: `i18n.ts` — Messages 인터페이스에 키 2개 추가**

`reflect: string` 아래에 추가:

```ts
  openInSource: string
  notFoundInSource: string
```

- [ ] **Step 2: `i18n.ts` — 8개 로케일에 문구 추가**

각 로케일 블록의 `reflect:` 줄 다음에 추가:

```ts
// en
    openInSource: 'View in the article',
    notFoundInSource: "Couldn't find it in the article",
// zh-CN
    openInSource: '在原文中查看',
    notFoundInSource: '未在原文中找到',
// zh-TW
    openInSource: '在原文中檢視',
    notFoundInSource: '在原文中找不到',
// ja
    openInSource: '本文で確認',
    notFoundInSource: '本文で見つかりませんでした',
// ko
    openInSource: '원문에서 확인',
    notFoundInSource: '원문에서 못 찾음',
// fr
    openInSource: "Voir dans l'article",
    notFoundInSource: "Introuvable dans l'article",
// es
    openInSource: 'Ver en el artículo',
    notFoundInSource: 'No se encontró en el artículo',
// ru
    openInSource: 'Показать в статье',
    notFoundInSource: 'Не найдено в статье',
```

- [ ] **Step 3: `App.vue` — 폴백 상태 + 클릭 핸들러 추가**

`<script setup>`에 `openHints` 근처로 추가:

```ts
// "원문에서 확인" 결과: 못 찾은 질문 인덱스 표시
const anchorNotFound = reactive<Record<number, boolean>>({})

async function openInSource(qIndex: number, anchor: string) {
  anchorNotFound[qIndex] = false
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    anchorNotFound[qIndex] = true
    return
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCROLL_TO', text: anchor })
    anchorNotFound[qIndex] = !res?.found
  } catch {
    anchorNotFound[qIndex] = true
  }
}
```

- [ ] **Step 4: `App.vue` — 생성 시 폴백 상태 초기화**

`generate()`의 성공 지점에서 `openHints` 초기화 줄을 아래로 교체:

```ts
    parsed.questions.forEach((_, i) => {
      openHints[i] = 0
      anchorNotFound[i] = false
    })
```

- [ ] **Step 5: `App.vue` — 질문 카드에 버튼 + 폴백 렌더**

각 질문 `<article class="card question">` 안, 힌트 버튼 블록 다음에 추가:

```html
        <div v-if="q.anchor" class="source-row">
          <button class="link" @click="openInSource(i, q.anchor)">📄 {{ t.openInSource }}</button>
          <span v-if="anchorNotFound[i]" class="not-found">{{ t.notFoundInSource }}</span>
        </div>
```

- [ ] **Step 6: `App.vue` — 스타일 추가**

`<style scoped>`에 추가:

```css
.source-row {
  margin-top: 8px;
}
.not-found {
  font-size: 12px;
  color: var(--muted);
  margin-left: 8px;
}
```

- [ ] **Step 7: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공. `t.openInSource`/`t.notFoundInSource`/`q.anchor`/`anchorNotFound` 참조가 모두 정의되어 타입 에러 없음.

- [ ] **Step 8: 수동 확인 (E2E)**

확장 리로드 → 기사 페이지 F5 → 패널에서 생성 → 각 질문에 "📄 원문에서 확인" 버튼이 보임 → 클릭 시 그 질문의 근거 문단으로 스크롤 + 노란 하이라이트(3초). 언어를 바꾸면 버튼·폴백 문구도 번역됨. anchor를 못 찾는 경우 버튼 옆에 "원문에서 못 찾음"이 뜨고 콘솔 에러 없음.

- [ ] **Step 9: (승인 시) 커밋**

```bash
git add src/i18n.ts src/sidepanel/App.vue
git commit -m "feat: 질문마다 '원문에서 확인' 버튼 + 앵커 이동 폴백"
```

---

## Self-Review 결과

- **스펙 커버리지**: §3.1 모드 재작성=Task1 Step2, §3.2 규칙=Task1 Step4, §3.3 스키마=Task1 Step1/3/5, §4.1 버튼=Task3 Step5, §4.2 하이라이트=Task2, §4.3 폴백=Task2 반환 + Task3 Step3/5, §5 i18n=Task3 Step1/2. 누락 없음.
- **플레이스홀더**: 없음(모든 스텝에 실제 코드/명령).
- **타입 일관성**: `Question.anchor`(Task1) ↔ `q.anchor`(Task3 Step5) ↔ 프롬프트 출력 `anchor`(Task1 Step5) 일치. `SCROLL_TO`/`{found}`(Task2) ↔ 패널 소비(Task3 Step3) 일치.
- **범위**: 단일 구현 계획으로 적정(3 태스크, 각 빌드 그린 + 수동 확인).
