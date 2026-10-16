// Migrated verbatim from Gitalk 1.x (src/i18n/*.json).
// Values keep v1's `singular |||| plural` pair where a locale has one; `t`
// picks the form before interpolation. Not ICU plural syntax.

export interface Messages {
  init: string
  'no-found-related': string
  'please-contact': string
  'init-issue': string
  'leave-a-comment': string
  preview: string
  edit: string
  comment: string
  'support-markdown': string
  'login-with-github': string
  'first-comment-person': string
  commented: string
  'load-more': string
  counts: string
  'sort-asc': string
  'sort-desc': string
  logout: string
  anonymous: string
}

export const locales = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'es-ES': 'Español',
  fr: 'Français',
  ru: 'Русский',
  de: 'Deutsch',
  pl: 'Polski',
  ko: '한국어',
  fa: 'فارسی',
  ja: '日本語',
} as const

type LocaleKey = keyof typeof locales

const bundles: Record<LocaleKey, Messages> = {
  'en': {"init": "Gitalking ...", "no-found-related": "Related %{link} not found", "please-contact": "Please contact %{user} to initialize the comment", "init-issue": "Init Issue", "leave-a-comment": "Leave a comment", "preview": "Preview", "edit": "Edit", "comment": "Comment", "support-markdown": "Markdown is supported", "login-with-github": "Login with GitHub", "first-comment-person": "Be the first person to leave a comment!", "commented": "commented", "load-more": "Load more", "counts": "%{counts} comment |||| %{counts} comments", "sort-asc": "Sort by Oldest", "sort-desc": "Sort by Latest", "logout": "Logout", "anonymous": "Anonymous"},
  'zh-CN': {"init": "Gitalk 加载中 ...", "no-found-related": "未找到相关的 %{link} 进行评论", "please-contact": "请联系 %{user} 初始化创建", "init-issue": "初始化 Issue", "leave-a-comment": "说点什么", "preview": "预览", "edit": "编辑", "comment": "评论", "support-markdown": "支持 Markdown 语法", "login-with-github": "使用 GitHub 登录", "first-comment-person": "来做第一个留言的人吧！", "commented": "发表于", "load-more": "加载更多", "counts": "%{counts} 条评论", "sort-asc": "从旧到新排序", "sort-desc": "从新到旧排序", "logout": "注销", "anonymous": "未登录用户"},
  'zh-TW': {"init": "Gitalk 載入中…", "no-found-related": "未找到相關的 %{link}", "please-contact": "請聯絡 %{user} 初始化評論", "init-issue": "初始化 Issue", "leave-a-comment": "寫點什麼", "preview": "預覽", "edit": "編輯", "comment": "評論", "support-markdown": "支援 Markdown 語法", "login-with-github": "使用 GitHub 登入", "first-comment-person": "成為首個留言的人吧！", "commented": "評論於", "load-more": "載入更多", "counts": "%{counts} 筆評論", "sort-asc": "從舊至新排序", "sort-desc": "從新至舊排序", "logout": "登出", "anonymous": "訪客"},
  'es-ES': {"init": "Gitalking ...", "no-found-related": "Link %{link} no encontrado", "please-contact": "Por favor contacta con %{user} para inicializar el comentario", "init-issue": "Iniciar Issue", "leave-a-comment": "Deja un comentario", "preview": "Avance", "edit": "Editar", "comment": "Comentario", "support-markdown": "Markdown es soportado", "login-with-github": "Entrar con GitHub", "first-comment-person": "Sé el primero en dejar un comentario!", "commented": "comentó", "load-more": "Cargar más", "counts": "%{counts} comentario |||| %{counts} comentarios", "sort-asc": "Ordenar por Antiguos", "sort-desc": "Ordenar por Recientes", "logout": "Salir", "anonymous": "Anónimo"},
  'fr': {"init": "Gitalking ...", "no-found-related": "Lien %{link} non trouvé", "please-contact": "S’il vous plaît contactez %{user} pour initialiser les commentaires", "init-issue": "Initialisation des issues", "leave-a-comment": "Laisser un commentaire", "preview": "Aperçu", "edit": "Modifier", "comment": "Commentaire", "support-markdown": "Markdown est supporté", "login-with-github": "Se connecter avec GitHub", "first-comment-person": "Être le premier à laisser un commentaire !", "commented": "commenter", "load-more": "Charger plus", "counts": "%{counts} commentaire |||| %{counts} commentaires", "sort-asc": "Trier par plus ancien", "sort-desc": "Trier par plus récent", "logout": "Déconnexion", "anonymous": "Anonyme"},
  'ru': {"init": "Gitalking ...", "no-found-related": "Связанные %{link} не найдены", "please-contact": "Пожалуйста, свяжитесь с %{user} чтобы инициализировать комментарий", "init-issue": "Выпуск инициализации", "leave-a-comment": "Оставить комментарий", "preview": "Предварительный просмотр", "edit": "Pедактировать", "comment": "Комментарий", "support-markdown": "Поддерживается Markdown", "login-with-github": "Вход через GitHub", "first-comment-person": "Будьте первым, кто оставил комментарий", "commented": "прокомментированный", "load-more": "Загрузить ещё", "counts": "%{counts} комментарий |||| %{counts} комментариев", "sort-asc": "Сортировать по старым", "sort-desc": "Сортировать по последним", "logout": "Выход", "anonymous": "Анонимный"},
  'de': {"init": "Gitalking ...", "no-found-related": "Zugehöriger %{link} nicht gefunden", "please-contact": "Bitte kontaktiere %{user} um den Kommentar zu initialisieren", "init-issue": "Initialisiere Issue", "leave-a-comment": "Hinterlasse einen Kommentar", "preview": "Vorschau", "edit": "Editieren", "comment": "Kommentieren", "support-markdown": "Markdown wird unterstützt", "login-with-github": "Mit GitHub-Account anmelden", "first-comment-person": "Sei die erste Person, welche einen Kommentar hinterlässt!", "commented": "kommentierte", "load-more": "Zeige mehr", "counts": "%{counts} Kommentar |||| %{counts} Kommentare", "sort-asc": "Älteste zuerst", "sort-desc": "Neuste zuerst", "logout": "Abmelden", "anonymous": "Anonym"},
  'pl': {"init": "Gitalking ...", "no-found-related": "Nie znaleziono powiązanego zgłoszenia: %{link}", "please-contact": "Skontaktuj się z %{user}, aby umożliwić komentowanie", "init-issue": "Utwórz zgłoszenie (GitHub Issue)", "leave-a-comment": "Skomentuj", "preview": "Podgląd", "edit": "Edytuj", "comment": "Wyślij", "support-markdown": "Możesz użyć składni Markdown", "login-with-github": "Zaloguj się poprzez GitHub", "first-comment-person": "Skomentuj jako pierwszy!", "commented": "skomentowany", "load-more": "Załaduj więcej", "counts": "%{counts} komentarz |||| %{counts} komentarze |||| %{counts} komentarzy", "sort-asc": "Sortuj od najstarszych", "sort-desc": "Sortuj od najnowszych", "logout": "Wyloguj", "anonymous": "Anonimowy"},
  'ko': {"init": "초기화 중 ...", "no-found-related": "관련 링크를 찾을 수 없습니다: %{link} ", "please-contact": "초기화를 위해 %{user} 에게 연락해 주세요", "init-issue": "이슈 초기화", "leave-a-comment": "댓글을 남겨보세요", "preview": "미리보기", "edit": "수정하기", "comment": "댓글 달기", "support-markdown": "마크다운(Markdown) 문법 지원", "login-with-github": "GitHub로 로그인하기", "first-comment-person": "첫 번째로 댓글을 남겨보세요!", "commented": "님이 작성함", "load-more": "더 보기", "counts": "댓글 %{counts} 개", "sort-asc": "오래된 댓글 먼저", "sort-desc": "최신 댓글 먼저", "logout": "로그아웃", "anonymous": "익명"},
  'fa': {"init": "بارگزاری ...", "no-found-related": "%{link} مرتبط پیدا نشد.", "please-contact": "لطفاً با %{user} اطلاع دهید تا اضافه کند.", "init-issue": "شروع نظرات", "leave-a-comment": "نظرتان را بنویسید", "preview": "پیش‌نمایش", "edit": "ویرایش", "comment": "ثبت", "support-markdown": "پشتیبانی از مارک‌داون", "login-with-github": "ورود با گیت‌هاب", "first-comment-person": "اولین نظر را شما بنویسید!", "commented": " - ", "load-more": "نظرات بیشتر", "counts": "%{counts} نظر |||| %{counts} نظر", "sort-asc": "مرتب‌سازی از قدیمی‌ترین", "sort-desc": "مرتب‌سازی از جدیدترین", "logout": "خروج", "anonymous": "بی‌نام"},
  'ja': {"init": "Gitalk を読み込んでいます...", "no-found-related": "%{link} に関連するものが見当たりません", "please-contact": "コメントを初期化するために %{user} に連絡してください", "init-issue": "イシューを初期化する", "leave-a-comment": "コメントを残す", "preview": "プレビュー", "edit": "編集する", "comment": "コメント", "support-markdown": "Markdown 記法をサポートしています", "login-with-github": "GitHub にログインする", "first-comment-person": "最初にコメントを残しましょう!", "commented": "によるコメント", "load-more": "もっと見る", "counts": "%{counts} つのコメント", "sort-asc": "投稿順に並び替え", "sort-desc": "最新順で並び替え", "logout": "ログアウト", "anonymous": "匿名"},
}

/**
 * Gitalk 2.0 keeps the same plain `%{key}` interpolation v1 used, so existing
 * community translations drop in unchanged.
 */
export function resolveLocale(requested?: string): LocaleKey {
  if (!requested) return 'en'
  if (requested in bundles) return requested as LocaleKey

  const lower = requested.toLowerCase()
  const base = lower.split('-')[0]
  const keys = Object.keys(bundles) as LocaleKey[]

  // Exact case-insensitive hit first: "zh-cn" -> "zh-CN".
  const exact = keys.find((k) => k.toLowerCase() === lower)
  if (exact) return exact

  // Then compare language subtag only, so bare "zh" resolves to zh-CN
  // (simplified) rather than silently falling back to English.
  const byBase = keys.find((k) => k.toLowerCase().split('-')[0] === base)
  return byBase ?? 'en'
}

export function createTranslator(locale?: string) {
  const key = resolveLocale(locale)
  const bundle = bundles[key]

  return function t(name: keyof Messages, vars: Record<string, string> = {}, pluralCount?: number): string {
    let text = bundle[name] ?? bundles.en[name] ?? String(name)

    // Locales that carry the `||||` pair need the form chosen before the
    // placeholders are filled — the count is not a number at that point, it is
    // an HTML link. The existing comment claimed the pairs were dropped; they
    // were not, which is why `||||` used to reach the page verbatim.
    if (text.includes('||||')) {
      const forms = text.split('||||').map((form) => form.trim())
      text = (pluralCount ?? 0) === 1 ? forms[0]! : (forms[1] ?? forms[0]!)
    }

    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`%{${k}}`).join(v)
    }
    return text
  }
}
