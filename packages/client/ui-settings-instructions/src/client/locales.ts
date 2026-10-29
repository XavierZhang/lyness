/**
 * Copy for the instructions section: what a person tells their own agents,
 * and the editor that changes it.
 *
 * @module @lyness/lyn-client-ui-settings-instructions/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  nav: 'Instructions',
  title: 'Your instructions',
  intro: 'What you tell your own agents, carried into every conversation you start from now on.',
  loading: 'Loading your instructions…',
  failed: 'Your instructions could not be read. Please try again.',
  retry: 'Try again',
  unowned: 'This deployment serves named people, and this page is reached without one. Sign in to read and write your own instructions.',
  placeholder: 'For example: call me Sam, answer in English, and show the command before you run it.',
  counter: '{used} of {max} characters',
  clear: 'Clear',
  save: 'Save',
  savedNotice: 'Saved.',
  unsaved: 'Unsaved changes.',
  lastSaved: 'Last saved {at}.',
  refused: 'That change was refused: {reason}',
  appliesToNew: 'A conversation already open keeps the instructions it started with.',
}

/** The instructions namespace key union. */
export type InstructionsKey = keyof typeof en

/** zh copy, checked complete against the English key set. */
export const zh: Record<InstructionsKey, string> = {
  nav: '指令',
  title: '你的指令',
  intro: '你对自己的 agent 说的话，从现在起带进你开的每一段对话。',
  loading: '正在读取你的指令…',
  failed: '读不到你的指令，请重试。',
  retry: '重试',
  unowned: '这个部署服务有名有姓的人，而这个页面是在没有身份的情况下打开的。登录后才能读写你自己的指令。',
  placeholder: '例如：叫我 Sam、用中文回答、执行命令前先把命令给我看。',
  counter: '{used} / {max} 字符',
  clear: '清空',
  save: '保存',
  savedNotice: '已保存。',
  unsaved: '有未保存的改动。',
  lastSaved: '上次保存于 {at}。',
  refused: '这次改动被拒绝：{reason}',
  appliesToNew: '已经开着的对话保持它开始时的那份指令。',
}

/** ja copy, checked complete against the English key set. */
export const ja: Record<InstructionsKey, string> = {
  nav: '指示',
  title: 'あなたの指示',
  intro: '自分のエージェントに伝えることで、これ以降に始めるすべての会話に引き継がれます。',
  loading: '指示を読み込み中…',
  failed: '指示を読み取れませんでした。もう一度お試しください。',
  retry: '再試行',
  unowned: 'このデプロイは名前のある人を対象にしていますが、このページは身元のない状態で開かれています。サインインすると自分の指示を読み書きできます。',
  placeholder: '例：Sam と呼ぶ、日本語で答える、コマンドは実行前に見せる。',
  counter: '{max} 文字中 {used} 文字',
  clear: '消去',
  save: '保存',
  savedNotice: '保存しました。',
  unsaved: '未保存の変更があります。',
  lastSaved: '最終保存：{at}',
  refused: 'その変更は拒否されました：{reason}',
  appliesToNew: 'すでに開いている会話は、開始時の指示のままです。',
}

/** es copy, checked complete against the English key set. */
export const es: Record<InstructionsKey, string> = {
  nav: 'Instrucciones',
  title: 'Tus instrucciones',
  intro: 'Lo que le dices a tus propios agentes, incorporado a cada conversación que inicies a partir de ahora.',
  loading: 'Cargando tus instrucciones…',
  failed: 'No se pudieron leer tus instrucciones. Inténtalo de nuevo.',
  retry: 'Reintentar',
  unowned: 'Este despliegue atiende a personas con nombre y esta página se abrió sin una. Inicia sesión para leer y escribir tus propias instrucciones.',
  placeholder: 'Por ejemplo: llámame Sam, responde en español y enséñame el comando antes de ejecutarlo.',
  counter: '{used} de {max} caracteres',
  clear: 'Borrar',
  save: 'Guardar',
  savedNotice: 'Guardado.',
  unsaved: 'Cambios sin guardar.',
  lastSaved: 'Guardado por última vez el {at}.',
  refused: 'Ese cambio fue rechazado: {reason}',
  appliesToNew: 'Una conversación ya abierta conserva las instrucciones con las que empezó.',
}

/** fr copy, checked complete against the English key set. */
export const fr: Record<InstructionsKey, string> = {
  nav: 'Instructions',
  title: 'Vos instructions',
  intro: 'Ce que vous dites à vos propres agents, repris dans chaque conversation que vous ouvrez désormais.',
  loading: 'Chargement de vos instructions…',
  failed: 'Vos instructions n’ont pas pu être lues. Veuillez réessayer.',
  retry: 'Réessayer',
  unowned: 'Ce déploiement sert des personnes nommées et cette page est atteinte sans l’une d’elles. Connectez-vous pour lire et écrire vos propres instructions.',
  placeholder: 'Par exemple : appelez-moi Sam, répondez en français et montrez la commande avant de l’exécuter.',
  counter: '{used} sur {max} caractères',
  clear: 'Effacer',
  save: 'Enregistrer',
  savedNotice: 'Enregistré.',
  unsaved: 'Modifications non enregistrées.',
  lastSaved: 'Dernier enregistrement le {at}.',
  refused: 'Ce changement a été refusé : {reason}',
  appliesToNew: 'Une conversation déjà ouverte garde les instructions avec lesquelles elle a commencé.',
}

/** de copy, checked complete against the English key set. */
export const de: Record<InstructionsKey, string> = {
  nav: 'Anweisungen',
  title: 'Ihre Anweisungen',
  intro: 'Was Sie Ihren eigenen Agenten sagen, übernommen in jedes Gespräch, das Sie von nun an beginnen.',
  loading: 'Ihre Anweisungen werden geladen…',
  failed: 'Ihre Anweisungen konnten nicht gelesen werden. Bitte erneut versuchen.',
  retry: 'Erneut versuchen',
  unowned: 'Diese Installation bedient benannte Personen, und diese Seite wurde ohne eine erreicht. Melden Sie sich an, um Ihre eigenen Anweisungen zu lesen und zu schreiben.',
  placeholder: 'Zum Beispiel: Nenn mich Sam, antworte auf Deutsch und zeig mir den Befehl, bevor du ihn ausführst.',
  counter: '{used} von {max} Zeichen',
  clear: 'Leeren',
  save: 'Speichern',
  savedNotice: 'Gespeichert.',
  unsaved: 'Nicht gespeicherte Änderungen.',
  lastSaved: 'Zuletzt gespeichert am {at}.',
  refused: 'Diese Änderung wurde abgelehnt: {reason}',
  appliesToNew: 'Ein bereits offenes Gespräch behält die Anweisungen, mit denen es begonnen hat.',
}

/** ru copy, checked complete against the English key set. */
export const ru: Record<InstructionsKey, string> = {
  nav: 'Инструкции',
  title: 'Ваши инструкции',
  intro: 'То, что вы говорите своим агентам, переносится в каждый разговор, который вы начнёте с этого момента.',
  loading: 'Загрузка ваших инструкций…',
  failed: 'Не удалось прочитать ваши инструкции. Попробуйте ещё раз.',
  retry: 'Повторить',
  unowned: 'Это развёртывание обслуживает названных людей, а эта страница открыта без такового. Войдите, чтобы читать и писать свои инструкции.',
  placeholder: 'Например: называй меня Sam, отвечай по-русски и показывай команду перед запуском.',
  counter: '{used} из {max} символов',
  clear: 'Очистить',
  save: 'Сохранить',
  savedNotice: 'Сохранено.',
  unsaved: 'Есть несохранённые изменения.',
  lastSaved: 'Последнее сохранение: {at}.',
  refused: 'Это изменение отклонено: {reason}',
  appliesToNew: 'Уже открытый разговор сохраняет инструкции, с которыми он начался.',
}

/** pt copy, checked complete against the English key set. */
export const pt: Record<InstructionsKey, string> = {
  nav: 'Instruções',
  title: 'As suas instruções',
  intro: 'O que diz aos seus próprios agentes, levado para cada conversa que iniciar a partir de agora.',
  loading: 'A carregar as suas instruções…',
  failed: 'Não foi possível ler as suas instruções. Tente novamente.',
  retry: 'Tentar novamente',
  unowned: 'Esta instalação serve pessoas com nome e esta página foi alcançada sem uma. Inicie sessão para ler e escrever as suas próprias instruções.',
  placeholder: 'Por exemplo: trate-me por Sam, responda em português e mostre o comando antes de o executar.',
  counter: '{used} de {max} caracteres',
  clear: 'Limpar',
  save: 'Guardar',
  savedNotice: 'Guardado.',
  unsaved: 'Alterações por guardar.',
  lastSaved: 'Guardado pela última vez em {at}.',
  refused: 'Essa alteração foi recusada: {reason}',
  appliesToNew: 'Uma conversa já aberta mantém as instruções com que começou.',
}
