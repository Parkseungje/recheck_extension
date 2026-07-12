import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'ReCheck',
  version: '0.0.1',
  description: '읽은 글을 스스로 되짚게 만드는 확장. AI는 정답을 주지 않고 질문·힌트만 던진다.',

  // 확장 아이콘 (툴바·확장관리·웹스토어). public/icons → dist/icons 로 복사됨.
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },

  // 툴바 아이콘 클릭 → 사이드패널 오픈 (동작은 service-worker에서 설정)
  action: {
    default_title: 'ReCheck 열기',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },

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
    'scripting', // 사용자 동작 후 활성 탭에서 본문 추출/스크롤 함수를 실행
    'activeTab', // 위 주입에 필요한 활성 탭 접근 권한 (아이콘 클릭 제스처로 부여)
  ],

  // ⚠️ 3사 API 도메인. 이게 없으면 확장에서 외부 호출이 CORS/CSP로 막힌다.
  host_permissions: [
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],

  optional_host_permissions: [
    'http://*/*',
    'https://*/*',
  ],

  // 본문 추출은 content_scripts로 모든 사이트에 자동 주입하지 않는다.
  // 사이드패널을 연 뒤 필요한 순간에 activeTab + scripting으로 활성 탭에서만 실행한다.
})
