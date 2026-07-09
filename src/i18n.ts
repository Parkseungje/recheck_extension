// UI 다국어 사전. AI가 만드는 질문·힌트는 글의 언어를 따르고(프롬프트 규칙),
// 여기서 번역하는 건 확장 UI의 고정 문구뿐이다.
//
// 새 언어 추가 = Locale에 코드 하나 + LOCALES에 항목 하나 + MESSAGES에 블록 하나.

export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'fr' | 'es' | 'ru'

// 드롭다운 표기는 각 언어의 자기 이름(endonym)으로 — 현재 UI 언어와 무관하게 찾기 쉽게.
export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
]

export const DEFAULT_LOCALE: Locale = 'en'

// 모델에게 "이 언어로 질문·힌트를 작성하라"고 지시할 때 쓰는 언어명.
// 영어명 + 원어명을 함께 줘서 어떤 모델이든 확실히 알아듣게 한다.
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  ru: 'Russian (Русский)',
}

export interface Messages {
  settings: string
  close: string
  provider: string
  language: string
  model: string
  questionCount: string
  apiKey: string
  keyNote: string
  save: string
  generating: string
  checkArticle: string
  regenerate: string
  dragHint: string
  selCount: (count: number) => string
  narrowHint: (max: number) => string
  articleCount: (count: number) => string
  truncNote: (max: number) => string
  articleTooLong: (max: number) => string
  needKey: string
  extractFailed: string
  selectionTooLong: (length: number, max: number) => string
  noActiveTab: string
  cantReadPage: string
  noArticle: string
  extractError: string
  unknownError: string
  modeLabel: string
  revealFirst: string
  revealMore: string
  openInSource: string
  notFoundInSource: string
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    settings: 'Settings',
    close: 'Close',
    provider: 'AI Provider',
    language: 'Language',
    model: 'Model',
    questionCount: 'Questions',
    apiKey: 'API Key',
    keyNote: 'Your key is stored only in this browser and is never sent to a server.',
    save: 'Save',
    generating: 'Thinking up questions…',
    checkArticle: 'Re-check this article',
    regenerate: 'Re-check this article (regenerate)',
    dragHint: 'Select part of the page to analyze only that part. (Whole article if nothing is selected.)',
    selCount: (count) => `${count.toLocaleString()} characters selected`,
    narrowHint: (max) => `· please narrow to ${max.toLocaleString()} characters or fewer`,
    articleCount: (count) => `Whole article: ${count.toLocaleString()} characters`,
    truncNote: (max) => `· over ${max.toLocaleString()} chars — drag to select a part`,
    articleTooLong: (max) =>
      `This article exceeds ${max.toLocaleString()} characters. Drag to select the part you want to analyze.`,
    needKey: 'Enter your API key first.',
    extractFailed: 'Failed to extract the article.',
    selectionTooLong: (length, max) =>
      `Your selection is too long (${length.toLocaleString()} characters). Please narrow it to ${max.toLocaleString()} characters or fewer.`,
    noActiveTab: "Couldn't find the active tab.",
    cantReadPage: "Couldn't read this page. (Try reloading, then try again.)",
    noArticle: "Couldn't find the main text on this page.",
    extractError: 'Error while extracting the text.',
    unknownError: 'Unknown error.',
    modeLabel: 'Mode',
    revealFirst: "Show a hint if you're stuck",
    revealMore: 'Show another hint',
    openInSource: 'View in the article',
    notFoundInSource: "Couldn't find it in the article",
  },
  'zh-CN': {
    settings: '设置',
    close: '关闭',
    provider: 'AI 提供方',
    language: '语言',
    model: '模型',
    questionCount: '问题数量',
    apiKey: 'API 密钥',
    keyNote: '密钥仅保存在此浏览器中，绝不会发送到任何服务器。',
    save: '保存',
    generating: '正在生成问题…',
    checkArticle: '重新回顾这篇文章',
    regenerate: '重新回顾这篇文章（重新生成）',
    dragHint: '在页面中选中某段文字，只分析该部分。（未选中则分析全文）',
    selCount: (count) => `已选 ${count.toLocaleString()} 个字符`,
    narrowHint: (max) => `· 请缩减到 ${max.toLocaleString()} 个字符以内`,
    articleCount: (count) => `全文 ${count.toLocaleString()} 个字符`,
    truncNote: (max) => `· 超过 ${max.toLocaleString()} 个字符 —— 请拖拽选择要分析的部分`,
    articleTooLong: (max) => `正文超过 ${max.toLocaleString()} 个字符。请拖拽选中要分析的部分。`,
    needKey: '请先输入 API 密钥。',
    extractFailed: '正文提取失败。',
    selectionTooLong: (length, max) =>
      `所选内容过长（${length.toLocaleString()} 个字符）。请缩减到 ${max.toLocaleString()} 个字符以内再选择。`,
    noActiveTab: '未找到当前活动标签页。',
    cantReadPage: '无法读取此页面。（请刷新后重试）',
    noArticle: '在此页面未找到正文。',
    extractError: '提取正文时发生错误。',
    unknownError: '未知错误。',
    modeLabel: '模式',
    revealFirst: '卡住时查看提示',
    revealMore: '查看更多提示',
    openInSource: '在原文中查看',
    notFoundInSource: '未在原文中找到',
  },
  'zh-TW': {
    settings: '設定',
    close: '關閉',
    provider: 'AI 供應商',
    language: '語言',
    model: '模型',
    questionCount: '問題數量',
    apiKey: 'API 金鑰',
    keyNote: '金鑰僅儲存在此瀏覽器中，絕不會傳送到任何伺服器。',
    save: '儲存',
    generating: '正在產生問題…',
    checkArticle: '重新回顧這篇文章',
    regenerate: '重新回顧這篇文章（重新產生）',
    dragHint: '在頁面中選取某段文字，只分析該部分。（未選取則分析全文）',
    selCount: (count) => `已選 ${count.toLocaleString()} 個字元`,
    narrowHint: (max) => `· 請縮減至 ${max.toLocaleString()} 個字元以內`,
    articleCount: (count) => `全文 ${count.toLocaleString()} 個字元`,
    truncNote: (max) => `· 超過 ${max.toLocaleString()} 個字元 —— 請拖曳選擇要分析的部分`,
    articleTooLong: (max) => `內文超過 ${max.toLocaleString()} 個字元。請拖曳選取要分析的部分。`,
    needKey: '請先輸入 API 金鑰。',
    extractFailed: '內文擷取失敗。',
    selectionTooLong: (length, max) =>
      `所選內容過長（${length.toLocaleString()} 個字元）。請縮減至 ${max.toLocaleString()} 個字元以內再選取。`,
    noActiveTab: '找不到目前作用中的分頁。',
    cantReadPage: '無法讀取此頁面。（請重新整理後再試一次）',
    noArticle: '在此頁面找不到內文。',
    extractError: '擷取內文時發生錯誤。',
    unknownError: '未知的錯誤。',
    modeLabel: '模式',
    revealFirst: '卡住時查看提示',
    revealMore: '查看更多提示',
    openInSource: '在原文中檢視',
    notFoundInSource: '在原文中找不到',
  },
  ja: {
    settings: '設定',
    close: '閉じる',
    provider: 'AI プロバイダー',
    language: '言語',
    model: 'モデル',
    questionCount: '質問数',
    apiKey: 'API キー',
    keyNote: 'キーはこのブラウザにのみ保存され、サーバーには送信されません。',
    save: '保存',
    generating: '問いを考えています…',
    checkArticle: 'この記事を振り返る',
    regenerate: 'この記事を振り返る（再生成）',
    dragHint: 'ページ内で範囲を選択すると、その部分だけを分析します。（選択がなければ本文全体）',
    selCount: (count) => `${count.toLocaleString()} 文字を選択中`,
    narrowHint: (max) => `・${max.toLocaleString()} 文字以下に絞ってください`,
    articleCount: (count) => `本文全体 ${count.toLocaleString()} 文字`,
    truncNote: (max) => `・${max.toLocaleString()} 文字超過 — 分析したい部分をドラッグしてください`,
    articleTooLong: (max) =>
      `本文が ${max.toLocaleString()} 文字を超えています。分析したい部分をドラッグして選択してください。`,
    needKey: '先に API キーを入力してください。',
    extractFailed: '本文の抽出に失敗しました。',
    selectionTooLong: (length, max) =>
      `選択範囲が長すぎます（${length.toLocaleString()} 文字）。${max.toLocaleString()} 文字以下に絞って選択してください。`,
    noActiveTab: 'アクティブなタブが見つかりませんでした。',
    cantReadPage: 'このページを読み取れませんでした。（再読み込みしてからもう一度お試しください）',
    noArticle: 'このページで本文が見つかりませんでした。',
    extractError: '本文の抽出中にエラーが発生しました。',
    unknownError: '不明なエラー。',
    modeLabel: 'モード',
    revealFirst: '行き詰まったらヒントを見る',
    revealMore: 'ヒントをもっと見る',
    openInSource: '本文で確認',
    notFoundInSource: '本文で見つかりませんでした',
  },
  ko: {
    settings: '설정',
    close: '닫기',
    provider: 'AI 제공자',
    language: '언어',
    model: '모델',
    questionCount: '질문 수',
    apiKey: 'API 키',
    keyNote: '키는 이 브라우저에만 저장되고 서버로 전송되지 않습니다.',
    save: '저장',
    generating: '생각할 거리 만드는 중…',
    checkArticle: '이 글, 다시 짚어보기',
    regenerate: '이 글, 다시 짚어보기 (재생성)',
    dragHint: '페이지에서 원하는 부분을 드래그하면 그 부분만 분석합니다. (선택 없으면 본문 전체, 최대 12,000자)',
    selCount: (count) => `선택 ${count.toLocaleString()}자`,
    narrowHint: (max) => `· ${max.toLocaleString()}자 이하로 좁혀주세요`,
    articleCount: (count) => `본문 전체 ${count.toLocaleString()}자`,
    truncNote: (max) => `· ${max.toLocaleString()}자 초과 — 원하는 부분을 드래그하세요`,
    articleTooLong: (max) => `본문이 ${max.toLocaleString()}자를 넘습니다. 원하는 부분을 드래그해서 분석하세요.`,
    needKey: 'API 키를 먼저 입력하세요.',
    extractFailed: '본문 추출에 실패했습니다.',
    selectionTooLong: (length, max) =>
      `선택한 영역이 너무 깁니다 (${length.toLocaleString()}자). ${max.toLocaleString()}자 이하로 좁혀서 선택하세요.`,
    noActiveTab: '활성 탭을 찾지 못했습니다.',
    cantReadPage: '이 페이지에서 본문을 읽지 못했습니다. (새로고침 후 다시 시도해 보세요)',
    noArticle: '이 페이지에서 본문을 찾지 못했습니다.',
    extractError: '본문 추출 중 오류가 발생했습니다.',
    unknownError: '알 수 없는 오류',
    modeLabel: '모드',
    revealFirst: '막히면 힌트 보기',
    revealMore: '힌트 더 보기',
    openInSource: '원문에서 확인',
    notFoundInSource: '원문에서 못 찾음',
  },
  fr: {
    settings: 'Paramètres',
    close: 'Fermer',
    provider: "Fournisseur d'IA",
    language: 'Langue',
    model: 'Modèle',
    questionCount: 'Nombre de questions',
    apiKey: 'Clé API',
    keyNote: "Votre clé est stockée uniquement dans ce navigateur et n'est jamais envoyée à un serveur.",
    save: 'Enregistrer',
    generating: 'Génération des questions…',
    checkArticle: 'Revoir cet article',
    regenerate: 'Revoir cet article (régénérer)',
    dragHint:
      "Sélectionnez une partie de la page pour n'analyser que celle-ci. (Article entier si rien n'est sélectionné.)",
    selCount: (count) => `${count.toLocaleString()} caractères sélectionnés`,
    narrowHint: (max) => `· veuillez réduire à ${max.toLocaleString()} caractères ou moins`,
    articleCount: (count) => `Article entier : ${count.toLocaleString()} caractères`,
    truncNote: (max) => `· plus de ${max.toLocaleString()} caractères — sélectionnez une partie par glisser`,
    articleTooLong: (max) =>
      `Cet article dépasse ${max.toLocaleString()} caractères. Sélectionnez par glisser la partie à analyser.`,
    needKey: "Saisissez d'abord votre clé API.",
    extractFailed: "Échec de l'extraction de l'article.",
    selectionTooLong: (length, max) =>
      `Votre sélection est trop longue (${length.toLocaleString()} caractères). Veuillez la réduire à ${max.toLocaleString()} caractères ou moins.`,
    noActiveTab: "Impossible de trouver l'onglet actif.",
    cantReadPage: 'Impossible de lire cette page. (Rechargez, puis réessayez.)',
    noArticle: 'Impossible de trouver le texte principal sur cette page.',
    extractError: "Erreur lors de l'extraction du texte.",
    unknownError: 'Erreur inconnue.',
    modeLabel: 'Mode',
    revealFirst: 'Afficher un indice si vous êtes bloqué',
    revealMore: 'Afficher un autre indice',
    openInSource: "Voir dans l'article",
    notFoundInSource: "Introuvable dans l'article",
  },
  es: {
    settings: 'Ajustes',
    close: 'Cerrar',
    provider: 'Proveedor de IA',
    language: 'Idioma',
    model: 'Modelo',
    questionCount: 'Número de preguntas',
    apiKey: 'Clave API',
    keyNote: 'Tu clave se guarda solo en este navegador y nunca se envía a un servidor.',
    save: 'Guardar',
    generating: 'Generando preguntas…',
    checkArticle: 'Repasar este artículo',
    regenerate: 'Repasar este artículo (regenerar)',
    dragHint:
      'Selecciona una parte de la página para analizar solo esa parte. (Todo el artículo si no seleccionas nada.)',
    selCount: (count) => `${count.toLocaleString()} caracteres seleccionados`,
    narrowHint: (max) => `· reduce la selección a ${max.toLocaleString()} caracteres o menos`,
    articleCount: (count) => `Artículo completo: ${count.toLocaleString()} caracteres`,
    truncNote: (max) => `· más de ${max.toLocaleString()} caracteres — arrastra para seleccionar una parte`,
    articleTooLong: (max) =>
      `El artículo supera los ${max.toLocaleString()} caracteres. Arrastra para seleccionar la parte que quieres analizar.`,
    needKey: 'Introduce primero tu clave API.',
    extractFailed: 'No se pudo extraer el artículo.',
    selectionTooLong: (length, max) =>
      `Tu selección es demasiado larga (${length.toLocaleString()} caracteres). Redúcela a ${max.toLocaleString()} caracteres o menos.`,
    noActiveTab: 'No se encontró la pestaña activa.',
    cantReadPage: 'No se pudo leer esta página. (Recarga e inténtalo de nuevo.)',
    noArticle: 'No se encontró el texto principal en esta página.',
    extractError: 'Error al extraer el texto.',
    unknownError: 'Error desconocido.',
    modeLabel: 'Modo',
    revealFirst: 'Ver una pista si te atascas',
    revealMore: 'Ver otra pista',
    openInSource: 'Ver en el artículo',
    notFoundInSource: 'No se encontró en el artículo',
  },
  ru: {
    settings: 'Настройки',
    close: 'Закрыть',
    provider: 'Провайдер ИИ',
    language: 'Язык',
    model: 'Модель',
    questionCount: 'Число вопросов',
    apiKey: 'API-ключ',
    keyNote: 'Ключ хранится только в этом браузере и никогда не отправляется на сервер.',
    save: 'Сохранить',
    generating: 'Формулирую вопросы…',
    checkArticle: 'Переосмыслить эту статью',
    regenerate: 'Переосмыслить эту статью (заново)',
    dragHint:
      'Выделите часть страницы, чтобы проанализировать только её. (Если ничего не выделено — вся статья.)',
    selCount: (count) => `Выделено символов: ${count.toLocaleString()}`,
    narrowHint: (max) => `· сократите до ${max.toLocaleString()} символов или меньше`,
    articleCount: (count) => `Вся статья: ${count.toLocaleString()} символов`,
    truncNote: (max) => `· больше ${max.toLocaleString()} символов — выделите нужную часть`,
    articleTooLong: (max) =>
      `Статья превышает ${max.toLocaleString()} символов. Выделите часть, которую хотите проанализировать.`,
    needKey: 'Сначала введите API-ключ.',
    extractFailed: 'Не удалось извлечь текст статьи.',
    selectionTooLong: (length, max) =>
      `Выделение слишком длинное (${length.toLocaleString()} символов). Сократите его до ${max.toLocaleString()} символов или меньше.`,
    noActiveTab: 'Не удалось найти активную вкладку.',
    cantReadPage: 'Не удалось прочитать эту страницу. (Обновите её и повторите попытку.)',
    noArticle: 'На этой странице не найден основной текст.',
    extractError: 'Ошибка при извлечении текста.',
    unknownError: 'Неизвестная ошибка.',
    modeLabel: 'Режим',
    revealFirst: 'Показать подсказку, если застряли',
    revealMore: 'Показать ещё подсказку',
    openInSource: 'Показать в статье',
    notFoundInSource: 'Не найдено в статье',
  },
}
