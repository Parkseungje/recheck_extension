<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { getProvider, parseQuestionSet, type ProviderId, type QuestionSet } from '../providers'
import { buildSystemPrompt, buildUserMessage } from '../prompt/build'
import { type Mode } from '../prompt/modes'
import type { ExtractResult } from '../content/extract'

// ---- 설정 (chrome.storage.local에 저장) ----
const settings = reactive({
  provider: 'claude' as ProviderId,
  model: '',
  apiKey: '',
})
const showSettings = ref(true)

// MVP: 적용 모드 고정. 'auto'로 두면 모델이 스스로 판별. (6단계에서 UI 노출)
const selectedMode = ref<Mode | 'auto'>('적용')

const providerObj = computed(() => getProvider(settings.provider))

onMounted(async () => {
  const saved = await chrome.storage.local.get(['provider', 'model', 'apiKey'])
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

async function extractArticle(): Promise<ExtractResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return { ok: false, error: '활성 탭을 찾지 못했습니다.' }
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' })
  } catch {
    return {
      ok: false,
      error: '이 페이지에서 본문을 읽지 못했습니다. (새로고침 후 다시 시도해 보세요)',
    }
  }
}

async function generate() {
  errorMsg.value = ''
  result.value = null
  if (!settings.apiKey) {
    showSettings.value = true
    errorMsg.value = 'API 키를 먼저 입력하세요.'
    return
  }

  loading.value = true
  try {
    const article = await extractArticle()
    if (!article.ok || !article.text) {
      throw new Error(article.error || '본문 추출 실패')
    }
    articleTitle.value = article.title || ''

    const systemPrompt = buildSystemPrompt(selectedMode.value)
    const userMessage = buildUserMessage(article.text)

    const raw = await providerObj.value.complete({
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt,
      userMessage,
    })

    const parsed = parseQuestionSet(raw)
    result.value = parsed
    parsed.questions.forEach((_, i) => (openHints[i] = 0))
  } catch (e: any) {
    errorMsg.value = e?.message ?? '알 수 없는 오류'
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
      {{ showSettings ? '닫기' : '설정' }}
    </button>
  </header>

  <!-- 설정 패널 -->
  <section v-if="showSettings" class="card">
    <label>
      AI Provider
      <select v-model="settings.provider" @change="onProviderChange">
        <option value="claude">Claude (Anthropic)</option>
        <option value="openai">GPT (OpenAI)</option>
        <option value="gemini">Gemini (Google)</option>
      </select>
    </label>

    <label>
      모델
      <select v-model="settings.model">
        <option v-for="m in providerObj.models" :key="m" :value="m">{{ m }}</option>
      </select>
    </label>

    <label>
      API 키
      <input v-model="settings.apiKey" type="password" placeholder="sk-... / AIza..." />
    </label>
    <p class="hint-note">키는 이 브라우저(chrome.storage.local)에만 저장되고 서버로 전송되지 않습니다.</p>

    <button class="primary" @click="saveSettings">저장</button>
  </section>

  <!-- 생성 버튼 -->
  <section v-if="!showSettings">
    <button class="primary block" :disabled="loading" @click="generate">
      {{ loading ? '생각할 거리 만드는 중…' : '이 글, 다시 짚어보기' }}
    </button>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <!-- 결과 -->
    <div v-if="result">
      <p class="mode-badge">모드: {{ result.mode }}</p>
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
          {{ (openHints[i] ?? 0) === 0 ? '막히면 힌트 보기' : '힌트 더 보기' }}
          ({{ openHints[i] ?? 0 }}/{{ q.hints.length }})
        </button>

        <p v-else class="pointer">📄 {{ q.source_pointer }}</p>
      </article>

      <p class="reflect">✍️ 답을 써봤다면 — 방금 네가 쓴 답을 다시 읽어봐.</p>
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
.pointer {
  font-size: 13px;
  color: var(--muted);
  margin: 6px 0 0;
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
