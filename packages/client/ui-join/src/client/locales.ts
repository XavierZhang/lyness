/**
 * Copy for the invitation page: what the link is, and how somebody redeems it.
 *
 * @module @lyness/lyn-client-ui-join/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  kicker: 'Invitation',
  title: 'You have been invited',
  hint: 'Sign in through one of the directories below and this invitation admits you. Your name and standing come from whoever invited you.',
  noChannel: 'This deployment has configured no sign-in directory yet, so the invitation cannot be redeemed. Ask whoever sent it.',
  continueWith: 'Continue with {name}',
  note: 'An invitation expires, allows a limited number of uses, and can be withdrawn. If none of the directories works for you, ask whoever sent it for another one.',
  workbench: 'Open the workbench',
  noCodeTitle: 'This link carries no invitation',
  noCodeHint: 'An invitation link carries its own code. Ask whoever invited you to send the whole link.',
  noAccountsTitle: 'This deployment needs no invitation',
  noAccountsHint: 'It serves the person at its keyboard, so there is nobody for an invitation to admit.',
  signedInTitle: 'You are already signed in',
  signedInHint: 'An invitation admits somebody this deployment has never heard of, and it knows you. Sign out first if you meant to join as somebody else.',
}

/** The join namespace key union. */
export type JoinKey = keyof typeof en

/** zh copy, checked complete against the English key set. */
export const zh: Record<JoinKey, string> = {
  kicker: '邀请',
  title: '有人邀请你加入',
  hint: '从下面任选一个目录登录，这张邀请码就会把你准入。你的名字与身份来自邀请你的那个人。',
  noChannel: '这个部署还没有配置任何登录目录，所以这张邀请码兑换不了。找发给你的那个人。',
  continueWith: '用「{name}」继续',
  note: '邀请码会过期、只能用有限的次数、也可以被撤回。如果下面的目录你一个都用不了，找发给你的人再要一张。',
  workbench: '前往工作台',
  noCodeTitle: '这条链接没有带邀请码',
  noCodeHint: '邀请链接自己带着那张码。请邀请你的人把完整的链接发给你。',
  noAccountsTitle: '这个部署不需要邀请码',
  noAccountsHint: '它服务的是坐在它键盘前的那个人，所以没有谁需要被邀请码准入。',
  signedInTitle: '你已经登录了',
  signedInHint: '邀请码准入的是这个部署从没听说过的人，而它认识你。如果你是想以另一个身份加入，先退出登录。',
}

/** ja copy, checked complete against the English key set. */
export const ja: Record<JoinKey, string> = {
  kicker: '招待',
  title: '招待されています',
  hint: '下のいずれかのディレクトリでサインインすると、この招待が受け入れます。名前と立場は招待した人が決めています。',
  noChannel: 'このデプロイにはまだサインイン用のディレクトリが設定されていないため、招待を引き換えられません。送った人に確認してください。',
  continueWith: '{name} で続ける',
  note: '招待には期限があり、使える回数も限られ、取り消されることもあります。どのディレクトリも使えない場合は、送った人に別の招待を依頼してください。',
  workbench: 'ワークベンチを開く',
  noCodeTitle: 'このリンクに招待コードがありません',
  noCodeHint: '招待リンクはコードを自分で持っています。招待した人にリンク全体を送ってもらってください。',
  noAccountsTitle: 'このデプロイに招待は不要です',
  noAccountsHint: 'キーボードの前にいる本人のために動くので、招待で受け入れる相手がいません。',
  signedInTitle: 'すでにサインインしています',
  signedInHint: '招待はこのデプロイが知らない人を受け入れるもので、あなたはすでに知られています。別の身元で参加するなら、先にサインアウトしてください。',
}

/** es copy, checked complete against the English key set. */
export const es: Record<JoinKey, string> = {
  kicker: 'Invitación',
  title: 'Te han invitado',
  hint: 'Inicia sesión con uno de los directorios de abajo y esta invitación te admitirá. Tu nombre y tu condición los decide quien te invitó.',
  noChannel: 'Esta instalación aún no tiene ningún directorio de inicio de sesión, así que la invitación no se puede canjear. Pregunta a quien te la envió.',
  continueWith: 'Continuar con {name}',
  note: 'Una invitación caduca, permite un número limitado de usos y puede retirarse. Si ninguno de los directorios te sirve, pide otra a quien te la envió.',
  workbench: 'Abrir el espacio de trabajo',
  noCodeTitle: 'Este enlace no lleva ninguna invitación',
  noCodeHint: 'Un enlace de invitación lleva su propio código. Pide a quien te invitó que te envíe el enlace completo.',
  noAccountsTitle: 'Esta instalación no necesita invitaciones',
  noAccountsHint: 'Sirve a la persona que está ante su teclado, así que no hay a quién admitir con una invitación.',
  signedInTitle: 'Ya has iniciado sesión',
  signedInHint: 'Una invitación admite a alguien que esta instalación no conoce, y a ti te conoce. Cierra la sesión si querías entrar como otra persona.',
}

/** fr copy, checked complete against the English key set. */
export const fr: Record<JoinKey, string> = {
  kicker: 'Invitation',
  title: 'Vous avez été invité',
  hint: 'Connectez-vous via l’un des annuaires ci-dessous et cette invitation vous admettra. Votre nom et votre qualité viennent de la personne qui vous a invité.',
  noChannel: 'Ce déploiement n’a encore aucun annuaire de connexion, l’invitation ne peut donc pas être utilisée. Demandez à la personne qui l’a envoyée.',
  continueWith: 'Continuer avec {name}',
  note: 'Une invitation expire, autorise un nombre limité d’utilisations et peut être retirée. Si aucun annuaire ne vous convient, demandez-en une autre à l’expéditeur.',
  workbench: 'Ouvrir l’espace de travail',
  noCodeTitle: 'Ce lien ne porte aucune invitation',
  noCodeHint: 'Un lien d’invitation porte son propre code. Demandez le lien complet à la personne qui vous a invité.',
  noAccountsTitle: 'Ce déploiement n’a pas besoin d’invitation',
  noAccountsHint: 'Il sert la personne devant son clavier : il n’y a personne qu’une invitation puisse admettre.',
  signedInTitle: 'Vous êtes déjà connecté',
  signedInHint: 'Une invitation admet quelqu’un que ce déploiement ne connaît pas, et il vous connaît. Déconnectez-vous d’abord si vous voulez entrer sous une autre identité.',
}

/** de copy, checked complete against the English key set. */
export const de: Record<JoinKey, string> = {
  kicker: 'Einladung',
  title: 'Sie wurden eingeladen',
  hint: 'Melden Sie sich über eines der Verzeichnisse unten an, und diese Einladung lässt Sie herein. Name und Stellung kommen von der Person, die Sie eingeladen hat.',
  noChannel: 'Diese Installation hat noch kein Anmeldeverzeichnis, deshalb lässt sich die Einladung nicht einlösen. Fragen Sie die Person, die sie geschickt hat.',
  continueWith: 'Mit {name} fortfahren',
  note: 'Eine Einladung verfällt, erlaubt eine begrenzte Anzahl Einlösungen und kann zurückgezogen werden. Passt keines der Verzeichnisse, bitten Sie um eine neue.',
  workbench: 'Arbeitsbereich öffnen',
  noCodeTitle: 'Dieser Link trägt keine Einladung',
  noCodeHint: 'Ein Einladungslink trägt seinen eigenen Code. Bitten Sie um den vollständigen Link.',
  noAccountsTitle: 'Diese Installation braucht keine Einladung',
  noAccountsHint: 'Sie dient der Person an ihrer Tastatur, es gibt also niemanden, den eine Einladung zulassen könnte.',
  signedInTitle: 'Sie sind bereits angemeldet',
  signedInHint: 'Eine Einladung lässt jemanden herein, den diese Installation nicht kennt — Sie kennt sie. Melden Sie sich ab, wenn Sie als jemand anderes beitreten wollten.',
}

/** ru copy, checked complete against the English key set. */
export const ru: Record<JoinKey, string> = {
  kicker: 'Приглашение',
  title: 'Вас пригласили',
  hint: 'Войдите через один из каталогов ниже, и это приглашение вас впустит. Имя и положение задаёт тот, кто вас пригласил.',
  noChannel: 'В этом развёртывании пока не настроен ни один каталог входа, поэтому приглашение не использовать. Спросите того, кто его прислал.',
  continueWith: 'Продолжить через {name}',
  note: 'Приглашение истекает, допускает ограниченное число использований и может быть отозвано. Если ни один каталог не подходит, попросите другое приглашение.',
  workbench: 'Открыть рабочее место',
  noCodeTitle: 'В этой ссылке нет приглашения',
  noCodeHint: 'Ссылка-приглашение несёт свой код. Попросите прислать ссылку целиком.',
  noAccountsTitle: 'Этому развёртыванию приглашения не нужны',
  noAccountsHint: 'Оно служит человеку за своей клавиатурой, так что впускать приглашением некого.',
  signedInTitle: 'Вы уже вошли',
  signedInHint: 'Приглашение впускает того, кого это развёртывание не знает, а вас оно знает. Выйдите, если хотели присоединиться под другим именем.',
}

/** pt copy, checked complete against the English key set. */
export const pt: Record<JoinKey, string> = {
  kicker: 'Convite',
  title: 'Foi convidado',
  hint: 'Entre através de um dos diretórios abaixo e este convite admite-o. O nome e a posição vêm de quem o convidou.',
  noChannel: 'Esta instalação ainda não tem nenhum diretório de início de sessão, por isso o convite não pode ser usado. Pergunte a quem o enviou.',
  continueWith: 'Continuar com {name}',
  note: 'Um convite caduca, permite um número limitado de utilizações e pode ser retirado. Se nenhum dos diretórios lhe serve, peça outro a quem o enviou.',
  workbench: 'Abrir a área de trabalho',
  noCodeTitle: 'Esta ligação não leva nenhum convite',
  noCodeHint: 'Uma ligação de convite leva o seu próprio código. Peça a ligação completa a quem o convidou.',
  noAccountsTitle: 'Esta instalação não precisa de convites',
  noAccountsHint: 'Serve a pessoa que está ao seu teclado, por isso não há ninguém que um convite possa admitir.',
  signedInTitle: 'Já tem sessão iniciada',
  signedInHint: 'Um convite admite alguém que esta instalação não conhece, e a você conhece. Termine a sessão se queria juntar-se como outra pessoa.',
}
