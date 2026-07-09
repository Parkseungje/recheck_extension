# ReCheck

> 읽은 글을 스스로 되짚게 만드는 크롬 확장.
> **AI는 정답을 주지 않는다.** 질문과 힌트만 던지고, 답에 도달하는 것은 사용자의 몫이다.

## 왜 만들었나

글이 매끄럽게 읽히면 뇌는 "안다"고 착각한다(이해 착각, *illusion of comprehension*). 챗봇에 물어보면 답을 주지만, 답을 받는 순간 회수(retrieval)가 일어나지 않아 학습으로 남지 않는다.

ReCheck는 정답 대신 **전이 질문 + 3단 힌트**만 제공한다. 힌트를 다 써도 정답은 나오지 않고, 최종적으로 **원문으로 돌아가게** 안내한다. 그래서:

- 챗봇과 다르다 — 정답을 주지 않는다.
- 오개념을 주입하지 않는다 — AI가 사실을 단정하지 않고 "어디를 보라"는 포인터만 던진다.

## 핵심 설계 결정

- **정답 미제공** — 안전 규칙(정답 금지·단정형 금지)을 프롬프트 뼈대에 단일화.
- **유저 호출 시에만 작동** — 자동 팝업 없음. 사이드패널에서 버튼을 눌러야 질문이 나온다.
- **글 유형 4모드** — 장르(무한) 대신 독자 목적으로 수렴: 적용 / 검증 / 논증 / 소화.
  프롬프트는 `공통 뼈대 1개 + 모드 조각 4개`로 조립 (`src/prompt/`).
- **멀티 provider (BYOK)** — Claude / GPT / Gemini를 전략 패턴으로 추상화 (`src/providers/`).
- **서버 없음** — 브라우저에서 각 API를 직접 호출. 키는 `chrome.storage.local`에만 저장.

## 기술 스택

Vue 3 · Vite · `@crxjs/vite-plugin` · TypeScript · `@mozilla/readability` · Chrome MV3 (Side Panel API)

## 프로젝트 구조

```
src/
├─ background/service-worker.ts   아이콘 클릭 → 사이드패널 오픈
├─ content/extract.ts             Readability로 본문 추출 (EXTRACT 메시지에만 반응)
├─ sidepanel/                     Vue UI (설정 · 질문 생성 · 힌트 계단 · 성찰)
├─ providers/                     전략 패턴: claude / openai / gemini + JSON 파서
│  ├─ types.ts                    Provider 인터페이스 · QuestionSet · parseQuestionSet
│  └─ index.ts                    provider 레지스트리
└─ prompt/                        공통 뼈대 + 모드 조각 + 조립기
   ├─ skeleton.ts                 안전 규칙이 담긴 공통 뼈대 (기본값)
   ├─ modes.ts                    4모드 정의 + 모드별 공식 조각
   └─ build.ts                    buildSystemPrompt(mode | 'auto')
```

## 개발 / 실행

```bash
npm install
npm run dev      # 개발 모드 (HMR)
npm run build    # 타입체크 + 프로덕션 빌드 → dist/
```

### 크롬에 로드하기 (개발자 모드)

1. `npm run build` 실행 → `dist/` 생성
2. 크롬에서 `chrome://extensions` 접속
3. 우측 상단 **개발자 모드** 켜기
4. **압축해제된 확장 프로그램을 로드합니다** → `dist/` 폴더 선택
5. 툴바의 ReCheck 아이콘 클릭 → 사이드패널이 열림
6. 설정에서 provider·모델·API 키 입력 → 아무 글에서나 "이 글, 다시 짚어보기"

> Side Panel API는 Chrome 114+ 필요.

## API 키 주의

- 키는 코드에 하드코딩하지 않는다. 런타임에 입력받아 `chrome.storage.local`에만 저장한다.
- `.env`·`*.key` 등은 `.gitignore`로 커밋 차단되어 있다.
- 이 구조는 개인용 로컬 설치를 전제로 한다. (브라우저 직접 호출은 키 노출을 감수하는 방식)

## 로드맵

- [x] 확장 뼈대 + Readability 본문 추출
- [x] Claude adapter + [적용 모드] 프롬프트 → 질문/힌트 렌더
- [x] GPT / Gemini adapter (전략 패턴)
- [ ] 설정 화면에서 프롬프트 직접 편집 (외부화 UI)
- [ ] 모드 조각 3개 활성화(검증·논증·소화) + 모드 드롭다운 / auto 판별
- [ ] 힌트 계단 UX·성찰 마무리 디자인 다듬기

## 라이선스

MIT
