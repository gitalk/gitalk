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
  /** Section heading above the list; the button still uses `comment`. */
  comments: string
  'support-markdown': string
  'login-with-github': string
  /** Short label for the sign-in button in the composer. */
  'login': string
  'first-comment-person': string
  commented: string
  'load-more': string
  counts: string
  'sort-asc': string
  'sort-desc': string
  logout: string
  anonymous: string
  reply: string
  'cancel': string
  'upvote': string
  'reactions-label': string
  'add-reaction': string
  'mention-label': string
  'reply-to': string
  'sending': string
  'not-posted': string
  'retry': string
  'discard': string
  'dismiss': string
  'login-to-comment': string
  'login-to-reply': string
  'login-to-react': string
  'login-to-upvote': string
  /**
   * Tooltip for the upvote control when GitHub itself refuses the mutation.
   *
   * Only shown for GitHub App user tokens (`ghu_`): `addUpvote` is closed to
   * integrations, so the button is disabled instead of failing on click.
   */
  'upvote-unavailable': string
  /** Static segment in the panel header; there is no hot-sort control. */
  'latest': string
  /** Badge marking a comment written by one of the configured admins. */
  'author': string
  /** Collapse the widget into its floating button. */
  'minimize': string
  /** Restore a collapsed widget from the floating button. */
  'open-comments': string
  /** Placeholder inside an open, empty Markdown preview. */
  'preview-empty': string
  /** Character counter in the floating preview, `%{count}` is a number. */
  'preview-chars': string
  /** Accessible label / text of the image-upload button. */
  'upload-image': string
  /** Button text while an upload is in flight. */
  'uploading-image': string
  /** Generic image-upload failure. */
  'image-upload-failed': string
  /** The upload handler did not settle before `imageUploadTimeout`. */
  'image-upload-timeout': string
  /** The upload was cancelled; the only failure that is not announced. */
  'image-upload-cancelled': string
  /** The handler returned a URL the widget refuses to insert. */
  'image-invalid-url': string
  /** Retry the failed upload with the same files. */
  'retry-upload': string
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
  'en': {"init":"Gitalking ...","no-found-related":"Related %{link} not found","please-contact":"Please contact %{user} to initialize the comment","init-issue":"Init Issue","leave-a-comment":"Write a comment, press Enter to post…","preview":"Preview","edit":"Edit","comment":"Comment","comments":"Comments","support-markdown":"Markdown is supported","login-with-github":"Login with GitHub","login":"Login","first-comment-person":"Be the first person to leave a comment!","commented":"commented","load-more":"Load more","counts":"%{counts} comment |||| %{counts} comments","sort-asc":"Sort by Oldest","sort-desc":"Sort by Latest","logout":"Logout","anonymous":"Anonymous","reply":"Reply","cancel":"Cancel","upvote":"Upvote","reactions-label":"Reactions","add-reaction":"Add reaction","mention-label":"Mention a participant","reply-to":"Reply to %{user}…","sending":"Sending…","not-posted":"Not posted","retry":"Retry","discard":"Discard","dismiss":"Dismiss","login-to-comment":"Sign in with GitHub to comment","login-to-reply":"Sign in with GitHub to reply","login-to-react":"Sign in with GitHub to react","login-to-upvote":"Sign in with GitHub to upvote","upvote-unavailable":"Upvoting isn't available with GitHub App sign-in","latest":"Latest","author":"Author","minimize":"Minimize comments","open-comments":"Open comments","preview-empty":"Nothing to preview yet.","preview-chars":"%{count} characters","upload-image":"Upload image","uploading-image":"Uploading…","image-upload-failed":"Image upload failed","image-upload-timeout":"Image upload timed out","image-upload-cancelled":"Image upload cancelled","image-invalid-url":"Image URL must be an absolute http(s) URL","retry-upload":"Retry upload"},
  'zh-CN': {"init":"Gitalk 加载中 ...","no-found-related":"未找到相关的 %{link} 进行评论","please-contact":"请联系 %{user} 初始化创建","init-issue":"初始化 Issue","leave-a-comment":"写下你的评论，按 Enter 发布…","preview":"预览","edit":"编辑","comment":"评论","comments":"评论","support-markdown":"支持 Markdown 语法","login-with-github":"使用 GitHub 登录","login":"登录","first-comment-person":"来做第一个留言的人吧！","commented":"发表于","load-more":"加载更多","counts":"%{counts} 条评论","sort-asc":"从旧到新排序","sort-desc":"从新到旧排序","logout":"注销","anonymous":"未登录用户","reply":"回复","cancel":"取消","upvote":"赞同","reactions-label":"表情回应","add-reaction":"添加回应","mention-label":"提及参与者","reply-to":"回复 %{user}…","sending":"发送中…","not-posted":"未发送","retry":"重试","discard":"丢弃","dismiss":"关闭","login-to-comment":"请使用 GitHub 登录后评论","login-to-reply":"请使用 GitHub 登录后回复","login-to-react":"请使用 GitHub 登录后添加回应","login-to-upvote":"请使用 GitHub 登录后赞同","upvote-unavailable":"使用 GitHub App 登录时无法赞同","latest":"最新","author":"作者","minimize":"最小化评论区","open-comments":"打开评论","preview-empty":"还没有可预览的内容。","preview-chars":"%{count} 字","upload-image":"上传图片","uploading-image":"图片上传中…","image-upload-failed":"图片上传失败","image-upload-timeout":"图片上传超时","image-upload-cancelled":"已取消图片上传","image-invalid-url":"图片地址必须是 http(s) 绝对地址","retry-upload":"重试上传"},
  'zh-TW': {"init":"Gitalk 載入中…","no-found-related":"未找到相關的 %{link}","please-contact":"請聯絡 %{user} 初始化評論","init-issue":"初始化 Issue","leave-a-comment":"寫下你的評論，按 Enter 發布…","preview":"預覽","edit":"編輯","comment":"評論","comments":"評論","support-markdown":"支援 Markdown 語法","login-with-github":"使用 GitHub 登入","login":"登入","first-comment-person":"成為首個留言的人吧！","commented":"評論於","load-more":"載入更多","counts":"%{counts} 筆評論","sort-asc":"從舊至新排序","sort-desc":"從新至舊排序","logout":"登出","anonymous":"訪客","reply":"回覆","cancel":"取消","upvote":"贊同","reactions-label":"表情回應","add-reaction":"新增回應","mention-label":"提及參與者","reply-to":"回覆 %{user}…","sending":"傳送中…","not-posted":"未送出","retry":"重試","discard":"丟棄","dismiss":"關閉","login-to-comment":"請使用 GitHub 登入後留言","login-to-reply":"請使用 GitHub 登入後回覆","login-to-react":"請使用 GitHub 登入後新增回應","login-to-upvote":"請使用 GitHub 登入後贊同","upvote-unavailable":"使用 GitHub App 登入時無法贊同","latest":"最新","author":"作者","minimize":"最小化評論區","open-comments":"開啟評論","preview-empty":"尚無可預覽的內容。","preview-chars":"%{count} 字","upload-image":"上傳圖片","uploading-image":"圖片上傳中…","image-upload-failed":"圖片上傳失敗","image-upload-timeout":"圖片上傳逾時","image-upload-cancelled":"已取消圖片上傳","image-invalid-url":"圖片網址必須是 http(s) 絕對網址","retry-upload":"重試上傳"},
  'es-ES': {"init":"Gitalking ...","no-found-related":"Link %{link} no encontrado","please-contact":"Por favor contacta con %{user} para inicializar el comentario","init-issue":"Iniciar Issue","leave-a-comment":"Deja un comentario","preview":"Avance","edit":"Editar","comment":"Comentario","comments":"Comentarios","support-markdown":"Markdown es soportado","login-with-github":"Entrar con GitHub","login":"Entrar","first-comment-person":"Sé el primero en dejar un comentario!","commented":"comentó","load-more":"Cargar más","counts":"%{counts} comentario |||| %{counts} comentarios","sort-asc":"Ordenar por Antiguos","sort-desc":"Ordenar por Recientes","logout":"Salir","anonymous":"Anónimo","reply":"Responder","cancel":"Cancelar","upvote":"Voto positivo","reactions-label":"Reacciones","add-reaction":"Añadir reacción","mention-label":"Menciona a un participante","reply-to":"Responder a %{user}…","sending":"Enviando…","not-posted":"No publicado","retry":"Reintentar","discard":"Descartar","dismiss":"Cerrar","login-to-comment":"Inicia sesión con GitHub para comentar","login-to-reply":"Inicia sesión con GitHub para responder","login-to-react":"Inicia sesión con GitHub para reaccionar","login-to-upvote":"Inicia sesión con GitHub para votar","upvote-unavailable":"No se puede votar con el inicio de sesión de GitHub App","latest":"Recientes","author":"Autor","minimize":"Minimizar comentarios","open-comments":"Abrir comentarios","preview-empty":"Nada que previsualizar todavía.","preview-chars":"%{count} caracteres","upload-image":"Subir imagen","uploading-image":"Subiendo…","image-upload-failed":"Error al subir la imagen","image-upload-timeout":"Se agotó el tiempo de subida","image-upload-cancelled":"Subida de imagen cancelada","image-invalid-url":"La URL de la imagen debe ser una URL absoluta http(s)","retry-upload":"Reintentar subida"},
  'fr': {"init":"Gitalking ...","no-found-related":"Lien %{link} non trouvé","please-contact":"S’il vous plaît contactez %{user} pour initialiser les commentaires","init-issue":"Initialisation des issues","leave-a-comment":"Laisser un commentaire","preview":"Aperçu","edit":"Modifier","comment":"Commentaire","comments":"Commentaires","support-markdown":"Markdown est supporté","login-with-github":"Se connecter avec GitHub","login":"Connexion","first-comment-person":"Être le premier à laisser un commentaire !","commented":"commenter","load-more":"Charger plus","counts":"%{counts} commentaire |||| %{counts} commentaires","sort-asc":"Trier par plus ancien","sort-desc":"Trier par plus récent","logout":"Déconnexion","anonymous":"Anonyme","reply":"Répondre","cancel":"Annuler","upvote":"Voter","reactions-label":"Réactions","add-reaction":"Ajouter une réaction","mention-label":"Mentionner un participant","reply-to":"Répondre à %{user}…","sending":"Envoi…","not-posted":"Non publié","retry":"Réessayer","discard":"Abandonner","dismiss":"Fermer","login-to-comment":"Connectez-vous avec GitHub pour commenter","login-to-reply":"Connectez-vous avec GitHub pour répondre","login-to-react":"Connectez-vous avec GitHub pour réagir","login-to-upvote":"Connectez-vous avec GitHub pour voter","upvote-unavailable":"Impossible de voter avec la connexion GitHub App","latest":"Récents","author":"Auteur","minimize":"Réduire les commentaires","open-comments":"Ouvrir les commentaires","preview-empty":"Rien à prévisualiser pour le moment.","preview-chars":"%{count} caractères","upload-image":"Téléverser une image","uploading-image":"Téléversement…","image-upload-failed":"Échec du téléversement de l’image","image-upload-timeout":"Délai de téléversement dépassé","image-upload-cancelled":"Téléversement annulé","image-invalid-url":"L’URL de l’image doit être une URL absolue http(s)","retry-upload":"Réessayer le téléversement"},
  'ru': {"init":"Gitalking ...","no-found-related":"Связанные %{link} не найдены","please-contact":"Пожалуйста, свяжитесь с %{user} чтобы инициализировать комментарий","init-issue":"Выпуск инициализации","leave-a-comment":"Оставить комментарий","preview":"Предварительный просмотр","edit":"Pедактировать","comment":"Комментарий","comments":"Комментарии","support-markdown":"Поддерживается Markdown","login-with-github":"Вход через GitHub","login":"Войти","first-comment-person":"Будьте первым, кто оставил комментарий","commented":"прокомментированный","load-more":"Загрузить ещё","counts":"%{counts} комментарий |||| %{counts} комментариев","sort-asc":"Сортировать по старым","sort-desc":"Сортировать по последним","logout":"Выход","anonymous":"Анонимный","reply":"Ответить","cancel":"Отмена","upvote":"Голос","reactions-label":"Реакции","add-reaction":"Добавить реакцию","mention-label":"Упомянуть участника","reply-to":"Ответить %{user}…","sending":"Отправка…","not-posted":"Не отправлено","retry":"Повторить","discard":"Отменить","dismiss":"Закрыть","login-to-comment":"Войдите через GitHub, чтобы комментировать","login-to-reply":"Войдите через GitHub, чтобы ответить","login-to-react":"Войдите через GitHub, чтобы поставить реакцию","login-to-upvote":"Войдите через GitHub, чтобы голосовать","upvote-unavailable":"Голосование недоступно при входе через GitHub App","latest":"Новые","author":"Автор","minimize":"Свернуть комментарии","open-comments":"Открыть комментарии","preview-empty":"Пока нечего предпросматривать.","preview-chars":"%{count} символов","upload-image":"Загрузить изображение","uploading-image":"Загрузка…","image-upload-failed":"Не удалось загрузить изображение","image-upload-timeout":"Время загрузки истекло","image-upload-cancelled":"Загрузка изображения отменена","image-invalid-url":"URL изображения должен быть абсолютным адресом http(s)","retry-upload":"Повторить загрузку"},
  'de': {"init":"Gitalking ...","no-found-related":"Zugehöriger %{link} nicht gefunden","please-contact":"Bitte kontaktiere %{user} um den Kommentar zu initialisieren","init-issue":"Initialisiere Issue","leave-a-comment":"Hinterlasse einen Kommentar","preview":"Vorschau","edit":"Editieren","comment":"Kommentieren","comments":"Kommentare","support-markdown":"Markdown wird unterstützt","login-with-github":"Mit GitHub-Account anmelden","login":"Anmelden","first-comment-person":"Sei die erste Person, welche einen Kommentar hinterlässt!","commented":"kommentierte","load-more":"Zeige mehr","counts":"%{counts} Kommentar |||| %{counts} Kommentare","sort-asc":"Älteste zuerst","sort-desc":"Neuste zuerst","logout":"Abmelden","anonymous":"Anonym","reply":"Antworten","cancel":"Abbrechen","upvote":"Upvote","reactions-label":"Reaktionen","add-reaction":"Reaktion hinzufügen","mention-label":"Teilnehmer erwähnen","reply-to":"Antwort an %{user}…","sending":"Wird gesendet…","not-posted":"Nicht gesendet","retry":"Erneut versuchen","discard":"Verwerfen","dismiss":"Schließen","login-to-comment":"Mit GitHub anmelden, um zu kommentieren","login-to-reply":"Mit GitHub anmelden, um zu antworten","login-to-react":"Mit GitHub anmelden, um zu reagieren","login-to-upvote":"Mit GitHub anmelden, um abzustimmen","upvote-unavailable":"Abstimmen ist mit GitHub-App-Anmeldung nicht möglich","latest":"Neueste","author":"Autor","minimize":"Kommentare minimieren","open-comments":"Kommentare öffnen","preview-empty":"Noch nichts zum Vorschauen.","preview-chars":"%{count} Zeichen","upload-image":"Bild hochladen","uploading-image":"Wird hochgeladen…","image-upload-failed":"Bild-Upload fehlgeschlagen","image-upload-timeout":"Zeitlimit für den Bild-Upload überschritten","image-upload-cancelled":"Bild-Upload abgebrochen","image-invalid-url":"Die Bild-URL muss eine absolute http(s)-URL sein","retry-upload":"Upload wiederholen"},
  'pl': {"init":"Gitalking ...","no-found-related":"Nie znaleziono powiązanego zgłoszenia: %{link}","please-contact":"Skontaktuj się z %{user}, aby umożliwić komentowanie","init-issue":"Utwórz zgłoszenie (GitHub Issue)","leave-a-comment":"Skomentuj","preview":"Podgląd","edit":"Edytuj","comment":"Wyślij","comments":"Komentarze","support-markdown":"Możesz użyć składni Markdown","login-with-github":"Zaloguj się poprzez GitHub","login":"Zaloguj","first-comment-person":"Skomentuj jako pierwszy!","commented":"skomentowany","load-more":"Załaduj więcej","counts":"%{counts} komentarz |||| %{counts} komentarze |||| %{counts} komentarzy","sort-asc":"Sortuj od najstarszych","sort-desc":"Sortuj od najnowszych","logout":"Wyloguj","anonymous":"Anonimowy","reply":"Odpowiedz","cancel":"Anuluj","upvote":"Głos","reactions-label":"Reakcje","add-reaction":"Dodaj reakcję","mention-label":"Wspomnij uczestnika","reply-to":"Odpowiedz do %{user}…","sending":"Wysyłanie…","not-posted":"Nie wysłano","retry":"Ponów","discard":"Odrzuć","dismiss":"Zamknij","login-to-comment":"Zaloguj się przez GitHub, aby komentować","login-to-reply":"Zaloguj się przez GitHub, aby odpowiadać","login-to-react":"Zaloguj się przez GitHub, aby reagować","login-to-upvote":"Zaloguj się przez GitHub, aby głosować","upvote-unavailable":"Głosowanie jest niedostępne przy logowaniu przez GitHub App","latest":"Najnowsze","author":"Autor","minimize":"Minimalizuj komentarze","open-comments":"Otwórz komentarze","preview-empty":"Nie ma jeszcze czego podglądać.","preview-chars":"%{count} znaków","upload-image":"Prześlij obraz","uploading-image":"Przesyłanie…","image-upload-failed":"Nie udało się przesłać obrazu","image-upload-timeout":"Przekroczono czas przesyłania obrazu","image-upload-cancelled":"Anulowano przesyłanie obrazu","image-invalid-url":"Adres obrazu musi być bezwzględnym adresem http(s)","retry-upload":"Ponów przesyłanie"},
  'ko': {"init":"초기화 중 ...","no-found-related":"관련 링크를 찾을 수 없습니다: %{link} ","please-contact":"초기화를 위해 %{user} 에게 연락해 주세요","init-issue":"이슈 초기화","leave-a-comment":"댓글을 남겨보세요","preview":"미리보기","edit":"수정하기","comment":"댓글 달기","comments":"댓글","support-markdown":"마크다운(Markdown) 문법 지원","login-with-github":"GitHub로 로그인하기","login":"로그인","first-comment-person":"첫 번째로 댓글을 남겨보세요!","commented":"님이 작성함","load-more":"더 보기","counts":"댓글 %{counts} 개","sort-asc":"오래된 댓글 먼저","sort-desc":"최신 댓글 먼저","logout":"로그아웃","anonymous":"익명","reply":"답글","cancel":"취소","upvote":"공감","reactions-label":"반응","add-reaction":"반응 추가","mention-label":"참여자 언급","reply-to":"%{user} 님에게 답글…","sending":"전송 중…","not-posted":"전송되지 않음","retry":"다시 시도","discard":"삭제","dismiss":"닫기","login-to-comment":"댓글을 남기려면 GitHub로 로그인하세요","login-to-reply":"답글을 남기려면 GitHub로 로그인하세요","login-to-react":"반응을 남기려면 GitHub로 로그인하세요","login-to-upvote":"공감하려면 GitHub로 로그인하세요","upvote-unavailable":"GitHub App 로그인으로는 공감할 수 없습니다","latest":"최신","author":"작성자","minimize":"댓글 최소화","open-comments":"댓글 열기","preview-empty":"아직 미리 볼 내용이 없습니다.","preview-chars":"%{count}자","upload-image":"이미지 업로드","uploading-image":"이미지 업로드 중…","image-upload-failed":"이미지 업로드 실패","image-upload-timeout":"이미지 업로드 시간 초과","image-upload-cancelled":"이미지 업로드 취소됨","image-invalid-url":"이미지 URL은 http(s) 절대 주소여야 합니다","retry-upload":"업로드 다시 시도"},
  'fa': {"init":"بارگزاری ...","no-found-related":"%{link} مرتبط پیدا نشد.","please-contact":"لطفاً با %{user} اطلاع دهید تا اضافه کند.","init-issue":"شروع نظرات","leave-a-comment":"نظرتان را بنویسید","preview":"پیش‌نمایش","edit":"ویرایش","comment":"ثبت","comments":"نظرات","support-markdown":"پشتیبانی از مارک‌داون","login-with-github":"ورود با گیت‌هاب","login":"ورود","first-comment-person":"اولین نظر را شما بنویسید!","commented":" - ","load-more":"نظرات بیشتر","counts":"%{counts} نظر |||| %{counts} نظر","sort-asc":"مرتب‌سازی از قدیمی‌ترین","sort-desc":"مرتب‌سازی از جدیدترین","logout":"خروج","anonymous":"بی‌نام","reply":"پاسخ","cancel":"انصراف","upvote":"رأی مثبت","reactions-label":"واکنش‌ها","add-reaction":"افزودن واکنش","mention-label":"اشاره به یک مشارکت‌کننده","reply-to":"پاسخ به %{user}…","sending":"در حال ارسال…","not-posted":"ارسال نشد","retry":"تلاش دوباره","discard":"کنار گذاشتن","dismiss":"بستن","login-to-comment":"برای نظر دادن با گیت‌هاب وارد شوید","login-to-reply":"برای پاسخ دادن با گیت‌هاب وارد شوید","login-to-react":"برای واکنش دادن با گیت‌هاب وارد شوید","login-to-upvote":"برای رأی دادن با گیت‌هاب وارد شوید","upvote-unavailable":"رأی دادن با ورود GitHub App ممکن نیست","latest":"جدیدترین","author":"نویسنده","minimize":"کوچک کردن نظرات","open-comments":"باز کردن نظرات","preview-empty":"هنوز چیزی برای پیش‌نمایش نیست.","preview-chars":"%{count} کاراکتر","upload-image":"بارگذاری تصویر","uploading-image":"در حال بارگذاری…","image-upload-failed":"بارگذاری تصویر ناموفق بود","image-upload-timeout":"زمان بارگذاری تصویر به پایان رسید","image-upload-cancelled":"بارگذاری تصویر لغو شد","image-invalid-url":"نشانی تصویر باید یک URL مطلق http(s) باشد","retry-upload":"تلاش دوباره برای بارگذاری"},
  'ja': {"init":"Gitalk を読み込んでいます...","no-found-related":"%{link} に関連するものが見当たりません","please-contact":"コメントを初期化するために %{user} に連絡してください","init-issue":"イシューを初期化する","leave-a-comment":"コメントを残す","preview":"プレビュー","edit":"編集する","comment":"コメント","comments":"コメント","support-markdown":"Markdown 記法をサポートしています","login-with-github":"GitHub にログインする","login":"ログイン","first-comment-person":"最初にコメントを残しましょう!","commented":"によるコメント","load-more":"もっと見る","counts":"%{counts} つのコメント","sort-asc":"投稿順に並び替え","sort-desc":"最新順で並び替え","logout":"ログアウト","anonymous":"匿名","reply":"返信","cancel":"キャンセル","upvote":"賛成","reactions-label":"リアクション","add-reaction":"リアクションを追加","mention-label":"参加者をメンション","reply-to":"%{user} さんに返信…","sending":"送信中…","not-posted":"送信できませんでした","retry":"再試行","discard":"破棄","dismiss":"閉じる","login-to-comment":"コメントするには GitHub でログインしてください","login-to-reply":"返信するには GitHub でログインしてください","login-to-react":"リアクションするには GitHub でログインしてください","login-to-upvote":"賛成するには GitHub でログインしてください","upvote-unavailable":"GitHub App ログインでは賛成できません","latest":"最新","author":"投稿者","minimize":"コメントを最小化","open-comments":"コメントを開く","preview-empty":"プレビューする内容がまだありません。","preview-chars":"%{count} 文字","upload-image":"画像をアップロード","uploading-image":"アップロード中…","image-upload-failed":"画像のアップロードに失敗しました","image-upload-timeout":"画像のアップロードがタイムアウトしました","image-upload-cancelled":"画像のアップロードをキャンセルしました","image-invalid-url":"画像 URL は http(s) の絶対 URL である必要があります","retry-upload":"アップロードを再試行"},
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

/** The function `createTranslator` returns; components accept one of these. */
export type Translator = (name: keyof Messages, vars?: Record<string, string>, pluralCount?: number) => string

export function createTranslator(locale?: string): Translator {
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
