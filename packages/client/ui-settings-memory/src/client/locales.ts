/**
 * Copy for the memory section: what a deployment remembers about one person,
 * and the removal they can ask for.
 *
 * @module @lyness/lyn-client-ui-settings-memory/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  nav: 'Memory',
  title: 'What is remembered about you',
  intro: 'Facts your agents kept when you asked them to. Every conversation you start begins with them.',
  loading: 'Loading your memories…',
  failed: 'Your memories could not be read. Please try again.',
  retry: 'Try again',
  unowned: 'This deployment serves named people, and this page is reached without one. Sign in to read what is remembered about you.',
  none: 'Nothing is remembered about you yet. Ask an agent to remember something and it appears here.',
  rememberedAt: 'Remembered {at}',
  forget: 'Forget',
  forgetting: 'Forgetting…',
  refused: 'That removal was refused: {reason}',
  sharedElsewhere: 'Facts this deployment keeps for everyone are not listed here; an administrator maintains those.',
}

/** The memory namespace key union. */
export type MemoryKey = keyof typeof en

/** zh copy, checked complete against the English key set. */
export const zh: Record<MemoryKey, string> = {
  nav: '记忆',
  title: '关于你的记忆',
  intro: '你让 agent 记住的事实。你开的每一段对话都从它们开始。',
  loading: '正在读取你的记忆…',
  failed: '读不到你的记忆，请重试。',
  retry: '重试',
  unowned: '这个部署服务有名有姓的人，而这个页面是在没有身份的情况下打开的。登录后才能读到关于你的记忆。',
  none: '还没有关于你的记忆。让 agent 记住点什么，它就会出现在这里。',
  rememberedAt: '记于 {at}',
  forget: '忘掉',
  forgetting: '正在忘掉…',
  refused: '这次删除被拒绝：{reason}',
  sharedElsewhere: '这个部署为所有人保留的事实不在这里列出，那些由管理员维护。',
}

/** ja copy, checked complete against the English key set. */
export const ja: Record<MemoryKey, string> = {
  nav: '記憶',
  title: 'あなたについて覚えていること',
  intro: 'あなたが頼んでエージェントが残した事実。あなたが始めるすべての会話はここから始まります。',
  loading: '記憶を読み込み中…',
  failed: '記憶を読み取れませんでした。もう一度お試しください。',
  retry: '再試行',
  unowned: 'このデプロイは名前のある人を対象にしていますが、このページは身元のない状態で開かれています。サインインすると自分についての記憶を読めます。',
  none: 'あなたについての記憶はまだありません。エージェントに何かを覚えるよう頼むと、ここに出てきます。',
  rememberedAt: '{at} に記録',
  forget: '忘れる',
  forgetting: '忘れています…',
  refused: 'その削除は拒否されました：{reason}',
  sharedElsewhere: 'このデプロイが全員のために保持する事実はここには出ません。それは管理者が管理します。',
}

/** es copy, checked complete against the English key set. */
export const es: Record<MemoryKey, string> = {
  nav: 'Memoria',
  title: 'Lo que se recuerda de ti',
  intro: 'Hechos que tus agentes guardaron cuando se lo pediste. Cada conversación que inicias empieza con ellos.',
  loading: 'Cargando tus recuerdos…',
  failed: 'No se pudieron leer tus recuerdos. Inténtalo de nuevo.',
  retry: 'Reintentar',
  unowned: 'Este despliegue atiende a personas con nombre y esta página se abrió sin una. Inicia sesión para leer lo que se recuerda de ti.',
  none: 'Todavía no se recuerda nada de ti. Pide a un agente que recuerde algo y aparecerá aquí.',
  rememberedAt: 'Recordado el {at}',
  forget: 'Olvidar',
  forgetting: 'Olvidando…',
  refused: 'Esa eliminación fue rechazada: {reason}',
  sharedElsewhere: 'Los hechos que este despliegue guarda para todos no se listan aquí; de esos se encarga un administrador.',
}

/** fr copy, checked complete against the English key set. */
export const fr: Record<MemoryKey, string> = {
  nav: 'Mémoire',
  title: 'Ce dont on se souvient de vous',
  intro: 'Des faits que vos agents ont gardés à votre demande. Chaque conversation que vous ouvrez commence avec eux.',
  loading: 'Chargement de vos souvenirs…',
  failed: 'Vos souvenirs n’ont pas pu être lus. Veuillez réessayer.',
  retry: 'Réessayer',
  unowned: 'Ce déploiement sert des personnes nommées et cette page est atteinte sans l’une d’elles. Connectez-vous pour lire ce dont on se souvient de vous.',
  none: 'On ne se souvient encore de rien à votre sujet. Demandez à un agent de retenir quelque chose et cela apparaîtra ici.',
  rememberedAt: 'Retenu le {at}',
  forget: 'Oublier',
  forgetting: 'Suppression…',
  refused: 'Cette suppression a été refusée : {reason}',
  sharedElsewhere: 'Les faits que ce déploiement garde pour tout le monde ne sont pas listés ici ; un administrateur s’en occupe.',
}

/** de copy, checked complete against the English key set. */
export const de: Record<MemoryKey, string> = {
  nav: 'Gedächtnis',
  title: 'Was über Sie gespeichert ist',
  intro: 'Fakten, die Ihre Agenten auf Ihre Bitte behalten haben. Jedes Gespräch, das Sie beginnen, beginnt mit ihnen.',
  loading: 'Ihre Erinnerungen werden geladen…',
  failed: 'Ihre Erinnerungen konnten nicht gelesen werden. Bitte erneut versuchen.',
  retry: 'Erneut versuchen',
  unowned: 'Diese Installation bedient benannte Personen, und diese Seite wurde ohne eine erreicht. Melden Sie sich an, um zu lesen, was über Sie gespeichert ist.',
  none: 'Über Sie ist noch nichts gespeichert. Bitten Sie einen Agenten, sich etwas zu merken, und es erscheint hier.',
  rememberedAt: 'Gespeichert am {at}',
  forget: 'Vergessen',
  forgetting: 'Wird vergessen…',
  refused: 'Diese Löschung wurde abgelehnt: {reason}',
  sharedElsewhere: 'Fakten, die diese Installation für alle behält, stehen nicht hier; die pflegt ein Administrator.',
}

/** ru copy, checked complete against the English key set. */
export const ru: Record<MemoryKey, string> = {
  nav: 'Память',
  title: 'Что о вас помнят',
  intro: 'Факты, которые ваши агенты сохранили по вашей просьбе. Каждый начатый вами разговор начинается с них.',
  loading: 'Загрузка ваших записей…',
  failed: 'Не удалось прочитать ваши записи. Попробуйте ещё раз.',
  retry: 'Повторить',
  unowned: 'Это развёртывание обслуживает названных людей, а эта страница открыта без такового. Войдите, чтобы прочитать, что о вас помнят.',
  none: 'О вас пока ничего не помнят. Попросите агента что-нибудь запомнить, и это появится здесь.',
  rememberedAt: 'Записано {at}',
  forget: 'Забыть',
  forgetting: 'Удаление…',
  refused: 'Это удаление отклонено: {reason}',
  sharedElsewhere: 'Факты, которые это развёртывание хранит для всех, здесь не перечислены: их ведёт администратор.',
}

/** pt copy, checked complete against the English key set. */
export const pt: Record<MemoryKey, string> = {
  nav: 'Memória',
  title: 'O que se lembra de si',
  intro: 'Factos que os seus agentes guardaram quando lhes pediu. Cada conversa que inicia começa com eles.',
  loading: 'A carregar as suas memórias…',
  failed: 'Não foi possível ler as suas memórias. Tente novamente.',
  retry: 'Tentar novamente',
  unowned: 'Esta instalação serve pessoas com nome e esta página foi alcançada sem uma. Inicie sessão para ler o que se lembra de si.',
  none: 'Ainda não se lembra nada de si. Peça a um agente para guardar algo e aparecerá aqui.',
  rememberedAt: 'Guardado em {at}',
  forget: 'Esquecer',
  forgetting: 'A esquecer…',
  refused: 'Essa remoção foi recusada: {reason}',
  sharedElsewhere: 'Os factos que esta instalação guarda para todos não são listados aqui; esses são mantidos por um administrador.',
}
