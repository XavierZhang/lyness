/**
 * Copy for the announcements row and its reader.
 *
 * @module @lyness/lyn-client-ui-settings-announcements/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  row: 'System announcements',
  open: 'View',
  title: 'System announcements',
  close: 'Close',
  empty: 'This deployment has published nothing yet.',
  loading: 'Loading announcements…',
  failed: 'The announcements could not be read. Please try again.',
  retry: 'Try again',
  releaseLabel: 'Release {version}',
  readMore: 'Full notes',
  latest: 'Latest: {title}',
  copy: 'Copy',
  copied: 'Copied',
  footnotes: 'Footnotes',
} as const

/** Key set of the announcements dictionaries. */
export type AnnouncementsKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<AnnouncementsKey, string> = {
  row: '系统公告',
  open: '查看',
  title: '系统公告',
  close: '关闭',
  empty: '这个部署还没有发布任何公告。',
  loading: '正在读取公告……',
  failed: '暂时无法读取公告，请重试。',
  retry: '重试',
  releaseLabel: '版本 {version}',
  readMore: '完整说明',
  latest: '最新：{title}',
  copy: '复制',
  copied: '已复制',
  footnotes: '脚注',
}

/** Japanese copy. */
export const ja: Record<AnnouncementsKey, string> = {
  row: 'システムのお知らせ',
  open: '表示',
  title: 'システムのお知らせ',
  close: '閉じる',
  empty: 'このデプロイはまだ何も公開していません。',
  loading: 'お知らせを読み込んでいます…',
  failed: 'お知らせを読み取れませんでした。もう一度お試しください。',
  retry: '再試行',
  releaseLabel: 'バージョン {version}',
  readMore: '完全なリリースノート',
  latest: '最新：{title}',
  copy: 'コピー',
  copied: 'コピーしました',
  footnotes: '脚注',
}

/** Spanish copy. */
export const es: Record<AnnouncementsKey, string> = {
  row: 'Anuncios del sistema',
  open: 'Ver',
  title: 'Anuncios del sistema',
  close: 'Cerrar',
  empty: 'Este despliegue aún no ha publicado nada.',
  loading: 'Cargando anuncios…',
  failed: 'No se pudieron leer los anuncios. Vuelva a intentarlo.',
  retry: 'Intentar de nuevo',
  releaseLabel: 'Versión {version}',
  readMore: 'Notas completas',
  latest: 'Más reciente: {title}',
  copy: 'Copiar',
  copied: 'Copiado',
  footnotes: 'Notas al pie',
}

/** French copy. */
export const fr: Record<AnnouncementsKey, string> = {
  row: 'Annonces du système',
  open: 'Afficher',
  title: 'Annonces du système',
  close: 'Fermer',
  empty: 'Ce déploiement n’a encore rien publié.',
  loading: 'Chargement des annonces…',
  failed: 'Les annonces n’ont pas pu être lues. Veuillez réessayer.',
  retry: 'Réessayer',
  releaseLabel: 'Version {version}',
  readMore: 'Notes complètes',
  latest: 'Dernière : {title}',
  copy: 'Copier',
  copied: 'Copié',
  footnotes: 'Notes de bas de page',
}

/** German copy. */
export const de: Record<AnnouncementsKey, string> = {
  row: 'Systemankündigungen',
  open: 'Ansehen',
  title: 'Systemankündigungen',
  close: 'Schließen',
  empty: 'Diese Installation hat noch nichts veröffentlicht.',
  loading: 'Ankündigungen werden geladen…',
  failed: 'Die Ankündigungen konnten nicht gelesen werden. Bitte erneut versuchen.',
  retry: 'Erneut versuchen',
  releaseLabel: 'Version {version}',
  readMore: 'Vollständige Hinweise',
  latest: 'Neueste: {title}',
  copy: 'Kopieren',
  copied: 'Kopiert',
  footnotes: 'Fußnoten',
}

/** Russian copy. */
export const ru: Record<AnnouncementsKey, string> = {
  row: 'Системные объявления',
  open: 'Посмотреть',
  title: 'Системные объявления',
  close: 'Закрыть',
  empty: 'Это развёртывание пока ничего не опубликовало.',
  loading: 'Загрузка объявлений…',
  failed: 'Не удалось прочитать объявления. Попробуйте снова.',
  retry: 'Попробовать снова',
  releaseLabel: 'Версия {version}',
  readMore: 'Полные примечания',
  latest: 'Последнее: {title}',
  copy: 'Копировать',
  copied: 'Скопировано',
  footnotes: 'Сноски',
}

/** Portuguese copy. */
export const pt: Record<AnnouncementsKey, string> = {
  row: 'Anúncios do sistema',
  open: 'Ver',
  title: 'Anúncios do sistema',
  close: 'Fechar',
  empty: 'Esta instalação ainda não publicou nada.',
  loading: 'A carregar anúncios…',
  failed: 'Não foi possível ler os anúncios. Tente novamente.',
  retry: 'Tentar novamente',
  releaseLabel: 'Versão {version}',
  readMore: 'Notas completas',
  latest: 'Mais recente: {title}',
  copy: 'Copiar',
  copied: 'Copiado',
  footnotes: 'Notas de rodapé',
}
