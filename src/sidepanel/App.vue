<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { getProvider, parseQuestionSet, type ProviderId, type QuestionSet } from '../providers'
import { buildSystemPrompt, buildUserMessage, MAX_ARTICLE_CHARS } from '../prompt/build'
import type { ExtractResult } from '../content/extract'
import { LOCALES, DEFAULT_LOCALE, MESSAGES, LANGUAGE_NAMES, type Locale } from '../i18n'

// ---- 설정 (chrome.storage.local에 저장) ----
const settings = reactive({
  provider: 'claude' as ProviderId,
  model: '',
  apiKey: '',
})
const showSettings = ref(true)

// ---- UI 언어 ----
const locale = ref<Locale>(DEFAULT_LOCALE)
const t = computed(() => MESSAGES[locale.value])
// 언어는 바꾸는 즉시 저장 (저장 버튼과 무관하게 바로 유지)
function persistLocale() {
  chrome.storage.local.set({ locale: locale.value })
}

const providerObj = computed(() => getProvider(settings.provider))

// content script가 실시간으로 보내주는 현재 페이지의 선택 글자수.
// 0이면 선택 없음 → 카운터 숨김.
const selectionLength = ref(0)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'SELECTION_LENGTH') selectionLength.value = msg.length
})

// 드래그 안 했을 때 보여줄 현재 페이지 본문 전체 글자수. (선택이 있으면 선택 카운터가 우선)
const articleLength = ref(0)
async function fetchArticleLength() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'ARTICLE_INFO' })
    articleLength.value = info?.length ?? 0
  } catch {
    articleLength.value = 0
  }
}

// 이미 열려 있던 탭은 확장 설치·업데이트 후 content script가 자동 주입되지 않는다.
// 패널이 열릴 때 활성 탭에 직접 주입해, 페이지 새로고침 없이도 선택 카운터가 뜨게 한다.
// (content script의 중복 주입 가드가 있어 이미 주입된 경우엔 아무 일도 하지 않는다.)
async function ensureContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !/^https?:/.test(tab.url ?? '')) return
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? []
    if (files.length) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files })
    }
  } catch {
    // chrome:// 등 주입 불가 페이지이거나 이미 주입됨 — 무시
  }
}

// 패널은 탭을 바꿔도 그대로 열려 있으므로, onMounted 한 번으론 부족하다.
// 활성 탭 전환·새 페이지 로드마다 그 탭 기준으로 다시 계산한다.
async function refreshForActiveTab() {
  selectionLength.value = 0 // 이전 탭의 선택 글자수 초기화
  await ensureContentScript()
  fetchArticleLength()
}

chrome.tabs.onActivated.addListener(() => refreshForActiveTab())
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) refreshForActiveTab()
})

onMounted(async () => {
  refreshForActiveTab()
  const saved = await chrome.storage.local.get(['provider', 'model', 'apiKey', 'locale'])
  if (saved.locale) locale.value = saved.locale
  if (saved.provider) settings.provider = saved.provider
  if (saved.apiKey) {
    settings.apiKey = saved.apiKey
    showSettings.value = false
  }
  settings.model = saved.model || providerObj.value.defaultModel
})

async function saveSettings() {
  if (settings.provider && !providerObj.value.models.includes(settings.model)) {
    settings.model = providerObj.value.defaultModel
  }
  await chrome.storage.local.set({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
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

async function extractArticle(): Promise<ExtractResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return { ok: false, code: 'NO_ACTIVE_TAB' }
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' })
  } catch {
    return { ok: false, code: 'CANT_READ' }
  }
}

// 추출 실패 코드를 현재 언어의 메시지로 변환.
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
    // 드래그로 고른 영역은 잘라 보내지 않는다 — 너무 길면 좁혀서 다시 선택하게 한다.
    if (article.isSelection && article.text.length > MAX_ARTICLE_CHARS) {
      throw new Error(t.value.selectionTooLong(article.text.length, MAX_ARTICLE_CHARS))
    }
    // 드래그 안 한 전체 본문이 제한을 넘으면 통째로 못 보낸다 — 드래그로만 가능.
    if (!article.isSelection && article.text.length > MAX_ARTICLE_CHARS) {
      throw new Error(t.value.articleTooLong(MAX_ARTICLE_CHARS))
    }
    articleTitle.value = article.title || ''

    const systemPrompt = buildSystemPrompt('auto', LANGUAGE_NAMES[locale.value])
    const userMessage = buildUserMessage(article.text)

    const raw = await providerObj.value.complete({
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt,
      userMessage,
    })

    const parsed = parseQuestionSet(raw)
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
    <h1>ReCheck</h1>
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

    <!-- 드래그하는 동안 선택 글자수 실시간 표시. 12,000자 넘으면 빨간색. -->
    <p
      v-if="selectionLength > 0"
      class="sel-count"
      :class="{ over: selectionLength > MAX_ARTICLE_CHARS }"
    >
      {{ t.selCount(selectionLength) }}
      <template v-if="selectionLength > MAX_ARTICLE_CHARS">{{ t.narrowHint(MAX_ARTICLE_CHARS) }}</template>
    </p>

    <!-- 드래그 안 했을 때: 본문 전체 글자수. 12,000자 초과면 통째 전송 불가 → 드래그 유도(빨강). -->
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
      <p class="mode-badge">{{ t.modeLabel }}: {{ result.mode }}</p>
      <p v-if="articleTitle" class="article-title">📖 {{ articleTitle }}</p>

      <article v-for="(q, i) in result.questions" :key="i" class="card question">
        <p class="q-text"><strong>Q{{ i + 1 }}.</strong> {{ q.question }}</p>

        <div v-if="openHints[i]" class="hints">
          <p v-for="(h, hi) in q.hints.slice(0, openHints[i])" :key="hi" class="hint">
            💡 {{ h }}
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
          <button class="link" @click="openInSource(i, q.anchor)">📄 {{ t.openInSource }}</button>
          <span v-if="anchorNotFound[i]" class="not-found">{{ t.notFoundInSource }}</span>
        </div>
      </article>

      <p class="reflect">{{ t.reflect }}</p>
    </div>
  </section>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
h1 {
  font-size: 16px;
  margin: 0;
  letter-spacing: -0.02em;
}
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 10px;
}
select,
input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--fg);
  background: #fff;
}
.sel-count {
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  padding: 6px 10px;
  margin: 8px 0 0;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.sel-count.over {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}
.hint-note {
  font-size: 11px;
  color: var(--muted);
  margin: 4px 0 12px;
}
button.primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 600;
}
button.primary:disabled {
  opacity: 0.6;
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
  padding: 2px 0;
}
.error {
  color: #dc2626;
  font-size: 13px;
}
.mode-badge {
  display: inline-block;
  font-size: 11px;
  color: var(--muted);
  background: var(--border);
  border-radius: 999px;
  padding: 2px 10px;
}
.article-title {
  font-size: 13px;
  color: var(--muted);
  margin: 6px 0 12px;
}
.question .q-text {
  margin: 0 0 10px;
}
.hints {
  margin-bottom: 8px;
}
.hint {
  background: #fffbeb;
  border-left: 3px solid #fbbf24;
  padding: 8px 10px;
  border-radius: 4px;
  margin: 6px 0;
  font-size: 13px;
}
.source-row {
  margin-top: 8px;
}
.not-found {
  font-size: 12px;
  color: var(--muted);
  margin-left: 8px;
}
.reflect {
  text-align: center;
  font-size: 13px;
  color: var(--fg);
  background: var(--card);
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 14px;
  margin-top: 4px;
}
</style>
