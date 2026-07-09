import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'ReCheck',
  version: '0.0.1',
  description: '읽은 글을 스스로 되짚게 만드는 확장. AI는 정답을 주지 않고 질문·힌트만 던진다.',

  // 툴바 아이콘 클릭 → 사이드패널 오픈 (동작은 service-worker에서 설정)
  action: { default_title: 'ReCheck 열기' },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },

  permissions: [
    'sidePanel', // 사이드패널 API
    'tabs', // 활성 탭 조회
    'storage', // provider 선택값 · API 키 · 프롬프트 저장
    'scripting', // 이미 열려 있던 탭에 content script 직접 주입 (새로고침 불필요)
    'activeTab', // 위 주입에 필요한 활성 탭 접근 권한 (아이콘 클릭 제스처로 부여)
  ],

  // ⚠️ 3사 API 도메인. 이게 없으면 확장에서 외부 호출이 CORS/CSP로 막힌다.
  host_permissions: [
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],

  // 본문 추출용 content script. 모든 페이지에 주입되지만
  // 평소엔 메시지 리스너만 달고 있고, 사용자가 "질문 생성"을 눌러
  // EXTRACT 메시지가 올 때만 DOM을 읽는다. (프라이버시: 자동 전송 없음)
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/extract.ts'],
      run_at: 'document_idle',
    },
  ],
})
