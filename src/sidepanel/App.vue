<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { getProvider, parseQuestionSet, type ProviderId, type Question, type QuestionSet } from '../providers'
import { buildSystemPrompt, buildUserMessage, MAX_ARTICLE_CHARS } from '../prompt/build'
import type { ExtractResult } from '../content/extract'
import { LOCALES, DEFAULT_LOCALE, MESSAGES, LANGUAGE_NAMES, type Locale } from '../i18n'

// ---- 설정 (chrome.storage.local에 저장) ----
const settings = reactive({
  provider: 'claude' as ProviderId,
  model: '',
  apiKey: '',
  questionCount: 2, // 생성할 질문 수 (1~5, 기본 2)
})
const showSettings = ref(true)

// ---- UI 언어 ----
const locale = ref<Locale>(DEFAULT_LOCALE)
const t = computed(() => MESSAGES[locale.value])
// 언어는 바꾸는 즉시 저장한다.
function persistLocale() {
  chrome.storage.local.set({ locale: locale.value })
}

const providerObj = computed(() => getProvider(settings.provider))

// 현재 페이지의 선택 글자수. 0이면 선택 없음으로 보고 카운터를 숨긴다.
const selectionLength = ref(0)
let selectionPollTimer: number | undefined

function originPatternFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

async function requestHostAccess(tabUrl: string): Promise<boolean> {
  if (!originPatternFromUrl(tabUrl)) {
    return false
  }

  const origins = ['http://*/*', 'https://*/*']
  const alreadyGranted = await chrome.permissions.contains({ origins })
  if (alreadyGranted) return true

  const granted = await chrome.permissions.request({ origins })
  return granted
}

async function executeInActiveTabInternal<T, Args extends unknown[]>(
  func: (...args: Args) => T,
  requestPermissionOnFailure: boolean,
  ...args: Args
): Promise<T | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return null
  }
  if (!/^https?:/.test(tab.url ?? '')) {
    return null
  }
  const tabId = tab.id
  const tabUrl = tab.url ?? ''

  const runScript = async (): Promise<T | null> => {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    })
    return (result?.result as T | undefined) ?? null
  }

  try {
    const result = await runScript()
    return result
  } catch (err) {
    if (requestPermissionOnFailure && await requestHostAccess(tabUrl)) {
      try {
        const result = await runScript()
        return result
      } catch (retryErr) {
        throw retryErr
      }
    }

    throw err
  }
}

async function executeInActiveTab<T, Args extends unknown[]>(
  func: (...args: Args) => T,
  ...args: Args
): Promise<T | null> {
  return executeInActiveTabInternal(func, false, ...args)
}

async function executeInActiveTabWithPermission<T, Args extends unknown[]>(
  func: (...args: Args) => T,
  ...args: Args
): Promise<T | null> {
  return executeInActiveTabInternal(func, true, ...args)
}

function getSelectionLengthFromPage(): number {
  return window.getSelection()?.toString().trim().length ?? 0
}

function getArticleLengthFromPage(): number {
  const container: HTMLElement =
    (document.querySelector('main') as HTMLElement | null) ??
    (document.querySelector('article') as HTMLElement | null) ??
    (document.querySelector('[role="main"]') as HTMLElement | null) ??
    document.body
  return (container.innerText ?? container.textContent ?? '').trim().length
}

function extractArticleFromPage(): ExtractResult {
  try {
    function extractBody(): { title: string; text: string } {
      const container: HTMLElement =
        (document.querySelector('main') as HTMLElement | null) ??
        (document.querySelector('article') as HTMLElement | null) ??
        (document.querySelector('[role="main"]') as HTMLElement | null) ??
        document.body
      return {
        title: document.title,
        text: (container.innerText ?? container.textContent ?? '').trim(),
      }
    }

    const selected = window.getSelection()?.toString().trim() ?? ''
    if (selected) {
      return {
        ok: true,
        title: document.title,
        text: selected,
        url: location.href,
        isSelection: true,
      }
    }

    const body = extractBody()
    if (!body.text) return { ok: false, code: 'NO_ARTICLE' }

    return {
      ok: true,
      title: body.title,
      text: body.text,
      url: location.href,
    }
  } catch {
    return { ok: false, code: 'EXTRACT_ERROR' }
  }
}

function scrollToAnchorFromPage(query: string): boolean {
  function ensureHighlightStyle(): void {
    if (document.getElementById('recheck-anchor-style')) return
    const style = document.createElement('style')
    style.id = 'recheck-anchor-style'
    style.textContent = `::highlight(recheck-anchor){ background-color:#fde047; color:inherit; }`
    document.head.appendChild(style)
  }

  function applyHighlight(range: Range): void {
    ensureHighlightStyle()
    const cssHighlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HighlightCtor = (window as unknown as { Highlight?: new (r: Range) => unknown }).Highlight
    if (!cssHighlights || !HighlightCtor) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      window.setTimeout(() => selection?.removeAllRanges(), 3000)
      return
    }
    cssHighlights.set('recheck-anchor', new HighlightCtor(range))
    window.setTimeout(() => cssHighlights.delete('recheck-anchor'), 3000)
  }

  function scrollToRange(range: Range): void {
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 2, behavior: 'smooth' })
  }

  function findRangeIgnoringWhitespace(text: string): Range | null {
    const needle = text.replace(/\s+/g, '')
    if (needle.length < 4) return null

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as Text).parentElement
        if (!parent || parent.closest('script,style,noscript')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })

    let compact = ''
    const map: { node: Text; offset: number }[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      const data = (node as Text).data
      for (let i = 0; i < data.length; i++) {
        if (/\s/.test(data[i])) continue
        compact += data[i]
        map.push({ node: node as Text, offset: i })
      }
    }

    const idx = compact.indexOf(needle)
    if (idx === -1) return null
    const start = map[idx]
    const end = map[idx + needle.length - 1]
    if (!start || !end) return null

    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset + 1)
    return range
  }

  const text = query.trim()
  if (!text) return false

  const selection = window.getSelection()
  selection?.removeAllRanges()
  const found = (window as unknown as { find: (...args: unknown[]) => boolean }).find(
    text, false, false, true, false, false, false,
  )
  if (found) {
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    selection?.removeAllRanges()
    if (range) {
      scrollToRange(range)
      applyHighlight(range)
    }
    return true
  }
  selection?.removeAllRanges()

  const range = findRangeIgnoringWhitespace(text)
  if (!range) return false
  scrollToRange(range)
  applyHighlight(range)
  return true
}

function canFindAnchorInPage(query: string): boolean {
  const needle = query.trim().replace(/\s+/g, '')
  if (needle.length < 4) return false

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      if (!parent || parent.closest('script,style,noscript')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let compact = ''
  let node: Node | null
  while ((node = walker.nextNode())) {
    compact += (node as Text).data.replace(/\s+/g, '')
    if (compact.includes(needle)) return true
    if (compact.length > needle.length * 4) compact = compact.slice(-needle.length * 2)
  }

  return false
}

// 드래그 선택이 없을 때 보여줄 현재 페이지 본문 전체 글자수.
const articleLength = ref(0)
async function fetchArticleLength() {
  try {
    articleLength.value = (await executeInActiveTab(getArticleLengthFromPage)) ?? 0
  } catch {
    articleLength.value = 0
  }
}

// 패널이 열린 동안 activeTab 권한으로 활성 탭의 현재 선택 상태를 읽는다.
async function fetchSelectionLength() {
  try {
    selectionLength.value = (await executeInActiveTab(getSelectionLengthFromPage)) ?? 0
  } catch {
    selectionLength.value = 0
  }
}

// 패널은 탭을 바꿔도 그대로 열려 있으므로 활성 탭 기준으로 다시 계산한다.
async function refreshForActiveTab() {
  selectionLength.value = 0 // 이전 탭의 선택 글자수 초기화
  await fetchSelectionLength()
  fetchArticleLength()
}

chrome.tabs.onActivated.addListener(() => refreshForActiveTab())
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) refreshForActiveTab()
})

onMounted(async () => {
  refreshForActiveTab()
  selectionPollTimer = window.setInterval(fetchSelectionLength, 700)
  const saved = await chrome.storage.local.get([
    'provider',
    'model',
    'apiKey',
    'locale',
    'questionCount',
  ])
  if (saved.locale) locale.value = saved.locale
  if (saved.provider) settings.provider = saved.provider
  if (saved.questionCount) settings.questionCount = saved.questionCount
  if (saved.apiKey) {
    settings.apiKey = saved.apiKey
    showSettings.value = false
  }
  settings.model = saved.model || providerObj.value.defaultModel
})

onUnmounted(() => {
  if (selectionPollTimer) window.clearInterval(selectionPollTimer)
})

async function saveSettings() {
  if (settings.provider && !providerObj.value.models.includes(settings.model)) {
    settings.model = providerObj.value.defaultModel
  }
  await chrome.storage.local.set({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
    questionCount: settings.questionCount,
  })
  showSettings.value = false
}

function onProviderChange() {
  settings.model = providerObj.value.defaultModel
}

// ---- 질문 생성 흐름 ----
const loading = ref(false)
const errorMsg = ref('')
const result = ref<QuestionSet | null>(null)
const articleTitle = ref('')
// 각 질문마다 열린 힌트 개수
const openHints = reactive<Record<number, number>>({})
// "원문에서 확인" 결과: 못 찾은 질문 인덱스 표시
const anchorNotFound = reactive<Record<number, boolean>>({})

async function openInSource(qIndex: number, anchor: string) {
  anchorNotFound[qIndex] = false
  try {
    const found = await executeInActiveTabWithPermission(scrollToAnchorFromPage, anchor)
    anchorNotFound[qIndex] = !found
  } catch {
    anchorNotFound[qIndex] = true
  }
}

async function extractArticle(): Promise<ExtractResult> {
  try {
    return (await executeInActiveTabWithPermission(extractArticleFromPage)) ?? { ok: false, code: 'NO_ACTIVE_TAB' }
  } catch {
    return { ok: false, code: 'CANT_READ' }
  }
}

// 추출 실패 코드를 현재 언어의 메시지로 변환한다.
function extractErrorMessage(article: ExtractResult): string {
  switch (article.code) {
    case 'NO_ACTIVE_TAB':
      return t.value.noActiveTab
    case 'CANT_READ':
      return t.value.cantReadPage
    case 'NO_ARTICLE':
      return t.value.noArticle
    case 'EXTRACT_ERROR':
      return t.value.extractError
    default:
      return t.value.extractFailed
  }
}

function isDuplicateQuestion(next: Question, current: Question[]): boolean {
  const key = `${next.question}\n${next.anchor}`.replace(/\s+/g, '')
  return current.some((q) => `${q.question}\n${q.anchor}`.replace(/\s+/g, '') === key)
}

async function filterFindableQuestions(questions: Question[]): Promise<Question[]> {
  const checked = await Promise.all(
    questions.map(async (q) => {
      if (!q.anchor.trim()) return null
      try {
        const found = await executeInActiveTabWithPermission(canFindAnchorInPage, q.anchor)
        return found ? q : null
      } catch {
        return null
      }
    }),
  )
  return checked.filter((q): q is Question => q !== null)
}

async function generateFindableQuestionSet(articleText: string): Promise<QuestionSet> {
  const targetCount = settings.questionCount
  const maxAttempts = 2
  const collected: Question[] = []
  let mode = ''

  for (let attempt = 0; attempt < maxAttempts && collected.length < targetCount; attempt++) {
    const missingCount = targetCount - collected.length
    const systemPrompt = buildSystemPrompt('auto', LANGUAGE_NAMES[locale.value], missingCount)
    const userMessage = buildUserMessage(articleText)

    const raw = await providerObj.value.complete({
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt,
      userMessage,
    })

    const parsed = parseQuestionSet(raw, missingCount)
    if (!mode) mode = parsed.mode

    const validQuestions = await filterFindableQuestions(parsed.questions)
    for (const q of validQuestions) {
      if (collected.length >= targetCount) break
      if (!isDuplicateQuestion(q, collected)) collected.push(q)
    }
  }

  if (!collected.length) {
    throw new Error('원문에서 확인 가능한 질문을 만들지 못했습니다. 다시 생성해 주세요.')
  }

  if (collected.length < targetCount) {
    errorMsg.value = `${targetCount}문제 중 ${collected.length}문제만 원문에서 확인 가능한 질문으로 만들었습니다.`
  }

  return { mode: mode || 'auto', questions: collected }
}

async function generate() {
  errorMsg.value = ''
  result.value = null
  if (!settings.apiKey) {
    showSettings.value = true
    errorMsg.value = t.value.needKey
    return
  }

  loading.value = true
  try {
    const article = await extractArticle()
    if (!article.ok || !article.text) {
      throw new Error(extractErrorMessage(article))
    }
    // 드래그로 고른 영역은 잘라 보내지 않는다. 너무 길면 다시 선택하게 한다.
    if (article.isSelection && article.text.length > MAX_ARTICLE_CHARS) {
      throw new Error(t.value.selectionTooLong(article.text.length, MAX_ARTICLE_CHARS))
    }
    // 선택이 없고 전체 본문이 제한을 넘으면 전송하지 않는다.
    if (!article.isSelection && article.text.length > MAX_ARTICLE_CHARS) {
      errorMsg.value = ''
      return
    }
    articleTitle.value = article.title || ''

    const parsed = await generateFindableQuestionSet(article.text)
    result.value = parsed
    parsed.questions.forEach((_, i) => {
      openHints[i] = 0
      anchorNotFound[i] = false
    })
  } catch (e: any) {
    errorMsg.value = e?.message ?? t.value.unknownError
  } finally {
    loading.value = false
  }
}

function revealHint(qIndex: number) {
  const q = result.value?.questions[qIndex]
  if (!q) return
  if ((openHints[qIndex] ?? 0) < q.hints.length) openHints[qIndex]++
}
</script>

<template>
  <header>
    <h1><span class="mark">Re</span>Check</h1>
    <button class="link" @click="showSettings = !showSettings">
      {{ showSettings ? t.close : t.settings }}
    </button>
  </header>

  <!-- 설정 패널 -->
  <section v-if="showSettings" class="card">
    <label>
      {{ t.language }}
      <select v-model="locale" @change="persistLocale">
        <option v-for="loc in LOCALES" :key="loc.value" :value="loc.value">{{ loc.label }}</option>
      </select>
    </label>

    <label>
      {{ t.provider }}
      <select v-model="settings.provider" @change="onProviderChange">
        <option value="claude">Claude (Anthropic)</option>
        <option value="openai">GPT (OpenAI)</option>
        <option value="gemini">Gemini (Google)</option>
      </select>
    </label>

    <label>
      {{ t.model }}
      <select v-model="settings.model">
        <option v-for="m in providerObj.models" :key="m" :value="m">{{ m }}</option>
      </select>
    </label>

    <label>
      {{ t.questionCount }}
      <select v-model.number="settings.questionCount">
        <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>

    <label>
      {{ t.apiKey }}
      <input v-model="settings.apiKey" type="password" placeholder="sk-... / AIza..." />
    </label>
    <p class="hint-note">{{ t.keyNote }}</p>

    <button class="primary" @click="saveSettings">{{ t.save }}</button>
  </section>

  <!-- 생성 버튼 -->
  <section v-if="!showSettings">
    <button class="primary block" :disabled="loading" @click="generate">
      {{ loading ? t.generating : result ? t.regenerate : t.checkArticle }}
    </button>
    <p class="hint-note">{{ t.dragHint }}</p>

    <!-- 드래그하는 동안 선택 글자수 표시. 12,000자를 넘으면 빨간색. -->
    <p
      v-if="selectionLength > 0"
      class="sel-count"
      :class="{ over: selectionLength > MAX_ARTICLE_CHARS }"
    >
      {{ t.selCount(selectionLength) }}
      <template v-if="selectionLength > MAX_ARTICLE_CHARS">{{ t.narrowHint(MAX_ARTICLE_CHARS) }}</template>
    </p>

    <!-- 드래그 선택이 없을 때 본문 전체 글자수 표시. 제한을 넘으면 드래그 선택을 유도한다. -->
    <p
      v-else-if="articleLength > 0"
      class="sel-count"
      :class="{ over: articleLength > MAX_ARTICLE_CHARS }"
    >
      {{ t.articleCount(articleLength) }}
      <template v-if="articleLength > MAX_ARTICLE_CHARS">{{ t.truncNote(MAX_ARTICLE_CHARS) }}</template>
    </p>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <!-- 결과 -->
    <div v-if="result">
      <p v-if="articleTitle" class="article-title"> {{ articleTitle }}</p>

      <article v-for="(q, i) in result.questions" :key="i" class="card question">
        <p class="q-text"><strong>Q{{ i + 1 }}.</strong> {{ q.question }}</p>

        <div v-if="openHints[i]" class="hints">
          <p v-for="(h, hi) in q.hints.slice(0, openHints[i])" :key="hi" class="hint">
            {{ h }}
          </p>
        </div>

        <button
          v-if="(openHints[i] ?? 0) < q.hints.length"
          class="link"
          @click="revealHint(i)"
        >
          {{ (openHints[i] ?? 0) === 0 ? t.revealFirst : t.revealMore }}
          ({{ openHints[i] ?? 0 }}/{{ q.hints.length }})
        </button>

        <div v-if="q.anchor" class="source-row">
          <button class="link" @click="openInSource(i, q.anchor)">{{ t.openInSource }}</button>
          <span v-if="anchorNotFound[i]" class="not-found">{{ t.notFoundInSource }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
h1 {
  font-size: 17px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.03em;
  color: var(--fg);
}
h1 .mark {
  color: var(--accent);
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 15px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.01em;
  margin-bottom: 13px;
}
select,
input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--fg);
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
select:focus,
input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--ring);
}

.hint-note {
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--muted);
  margin: 4px 0 14px;
}

/* Primary action */
button.primary {
  background: linear-gradient(135deg, #16b8a6 0%, var(--accent) 55%, var(--accent-strong) 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  box-shadow: 0 8px 18px -10px rgba(13, 148, 136, 0.65);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
}
button.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px -10px rgba(13, 148, 136, 0.7);
  filter: saturate(1.05);
}
button.primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 5px 12px -8px rgba(13, 148, 136, 0.6);
}
button.primary:disabled {
  opacity: 0.5;
  box-shadow: none;
  cursor: default;
}
button.block {
  width: 100%;
  margin-bottom: 12px;
}

button.link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  padding: 3px 0;
  transition: color 0.15s ease;
}
button.link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
}

:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ring);
  border-radius: 6px;
}

/* Character counters */
.sel-count {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm);
  padding: 7px 11px;
  margin: 10px 0 0;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--accent-line);
}
.sel-count.over {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger-border);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-sm);
  padding: 9px 11px;
  font-size: 13px;
  margin: 10px 0 0;
}

.mode-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--accent-strong);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  padding: 3px 11px;
}
.article-title {
  font-size: 13px;
  color: var(--muted);
  margin: 8px 0 12px;
}

.question .q-text {
  margin: 0 0 12px;
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--fg);
}
.question .q-text strong {
  color: var(--accent);
  font-weight: 800;
  margin-right: 2px;
}

.hints {
  margin-bottom: 8px;
}
.hint {
  background: linear-gradient(0deg, #f2faf8, #f2faf8);
  border-left: 3px solid var(--accent);
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  margin: 7px 0;
  font-size: 13px;
  line-height: 1.55;
  color: #12403b;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.not-found {
  font-size: 12px;
  color: var(--muted);
}
</style>
