/**
 * Copy for the administration console's own chrome: the nav groups, the header,
 * and what it says when a deployment composed no administration page at all.
 *
 * Each page inside the console brings its own dictionary; nothing here names a
 * page, because the nav label is the page's own localized text.
 *
 * @module @lyness/lyn-client-ui-admin-console/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  console: 'Administration',
  workbench: 'Open the workbench',
  group_organization: 'Organization and people',
  group_capability: 'Access and capability',
  group_platform: 'Data and platform',
  group_other: 'Other',
  empty: 'This deployment composed no administration page.',
  emptyHint: 'Select the modules whose pages you need — accounts, credits, model governance — and they appear here.',
  signedInAs: 'Signed in as {name}',
  signOut: 'Sign out',
  nobody: 'Nobody is signed in',
  refused: 'This page is for administrators.',
  signInTitle: 'Sign in to administer this deployment',
  signInHint: 'The console is for the people this installation trusts with it. Choose how you sign in.',
  signInNoChannel: 'This deployment has configured no sign-in channel yet, so nobody can sign in. Whoever deployed it configures one in the composition file.',
  refusedHint: 'Your account administers nothing here, so there is nothing to show. Ask whoever administers this installation.',
}

/** The console namespace key union. */
export type AdminConsoleKey = keyof typeof en

/** zh copy, checked complete against the English key set. */
export const zh: Record<AdminConsoleKey, string> = {
  console: '管理端',
  workbench: '前往工作台',
  group_organization: '组织与人员',
  group_capability: '接入与能力',
  group_platform: '数据与平台',
  group_other: '其他',
  empty: '这个部署没有组合任何管理页。',
  emptyHint: '选上你需要的模块——账号、额度、模型治理——它们的页面就会出现在这里。',
  signedInAs: '当前登录：{name}',
  signOut: '退出登录',
  nobody: '尚未登录',
  refused: '这一页是给管理员的。',
  signInTitle: '登录后才能管理这套部署',
  signInHint: '管理端只给这套安装信任的人。选择你的登录方式。',
  signInNoChannel: '这个部署还没有配置任何登录渠道，所以谁都进不来。部署它的人在组合文件里配置一个。',
  refusedHint: '你的账号在这里没有管理范围，所以没有可显示的内容。需要的话，找这套安装的管理员。',
}

/** ja copy. */
export const ja: Record<AdminConsoleKey, string> = {
  console: '管理コンソール',
  workbench: 'ワークベンチを開く',
  group_organization: '組織とメンバー',
  group_capability: '接続と機能',
  group_platform: 'データとプラットフォーム',
  group_other: 'その他',
  empty: 'このデプロイには管理ページが構成されていません。',
  emptyHint: '必要なモジュール（アカウント、クレジット、モデルガバナンス）を選ぶと、そのページがここに表示されます。',
  signedInAs: 'ログイン中: {name}',
  signOut: 'ログアウト',
  nobody: '未ログイン',
  refused: 'このページは管理者向けです。',
  signInTitle: 'このデプロイを管理するにはログインしてください',
  signInHint: '管理コンソールはこのインストールが信頼する人のためのものです。ログイン方法を選んでください。',
  signInNoChannel: 'このデプロイにはログインチャネルがまだ設定されていないため、誰もログインできません。デプロイした担当者が構成ファイルで設定します。',
  refusedHint: 'あなたのアカウントにはここで管理する対象がないため、表示する内容はありません。必要な場合はこのインストールの管理者にご連絡ください。',
}

/** es copy. */
export const es: Record<AdminConsoleKey, string> = {
  console: 'Administración',
  workbench: 'Abrir el espacio de trabajo',
  group_organization: 'Organización y personas',
  group_capability: 'Acceso y capacidades',
  group_platform: 'Datos y plataforma',
  group_other: 'Otros',
  empty: 'Este despliegue no compuso ninguna página de administración.',
  emptyHint: 'Selecciona los módulos cuyas páginas necesites —cuentas, créditos, gobernanza de modelos— y aparecerán aquí.',
  signedInAs: 'Sesión de {name}',
  signOut: 'Cerrar sesión',
  nobody: 'Nadie ha iniciado sesión',
  refused: 'Esta página es para administradores.',
  signInTitle: 'Inicia sesión para administrar este despliegue',
  signInHint: 'La consola es para las personas en quienes esta instalación confía. Elige cómo iniciar sesión.',
  signInNoChannel: 'Este despliegue aún no tiene ningún canal de inicio de sesión configurado, así que nadie puede entrar. Quien lo despliegue configura uno en el archivo de composición.',
  refusedHint: 'Tu cuenta no administra nada aquí, así que no hay nada que mostrar. Pregunta a quien administre esta instalación.',
}

/** fr copy. */
export const fr: Record<AdminConsoleKey, string> = {
  console: 'Administration',
  workbench: 'Ouvrir l\'espace de travail',
  group_organization: 'Organisation et personnes',
  group_capability: 'Accès et capacités',
  group_platform: 'Données et plateforme',
  group_other: 'Autres',
  empty: 'Ce déploiement n\'a composé aucune page d\'administration.',
  emptyHint: 'Sélectionnez les modules dont vous avez besoin — comptes, crédits, gouvernance des modèles — et leurs pages apparaîtront ici.',
  signedInAs: 'Connecté : {name}',
  signOut: 'Se déconnecter',
  nobody: 'Personne n\'est connecté',
  refused: 'Cette page est réservée aux administrateurs.',
  signInTitle: 'Connectez-vous pour administrer ce déploiement',
  signInHint: 'La console est réservée aux personnes à qui cette installation fait confiance. Choisissez votre méthode de connexion.',
  signInNoChannel: 'Ce déploiement n\'a encore aucun canal de connexion configuré : personne ne peut entrer. La personne qui l\'a déployé en configure un dans le fichier de composition.',
  refusedHint: 'Votre compte n\'administre rien ici, il n\'y a donc rien à afficher. Adressez-vous à la personne qui administre cette installation.',
}

/** de copy. */
export const de: Record<AdminConsoleKey, string> = {
  console: 'Administration',
  workbench: 'Arbeitsbereich öffnen',
  group_organization: 'Organisation und Personen',
  group_capability: 'Zugang und Funktionen',
  group_platform: 'Daten und Plattform',
  group_other: 'Weiteres',
  empty: 'Diese Installation hat keine Administrationsseite zusammengestellt.',
  emptyHint: 'Wählen Sie die Module, deren Seiten Sie brauchen – Konten, Guthaben, Modell-Governance –, dann erscheinen sie hier.',
  signedInAs: 'Angemeldet als {name}',
  signOut: 'Abmelden',
  nobody: 'Niemand ist angemeldet',
  refused: 'Diese Seite ist für Administratoren.',
  signInTitle: 'Melden Sie sich an, um diese Installation zu verwalten',
  signInHint: 'Die Konsole ist für die Personen, denen diese Installation sie zutraut. Wählen Sie Ihre Anmeldung.',
  signInNoChannel: 'Diese Installation hat noch keinen Anmeldekanal konfiguriert, also kann sich niemand anmelden. Wer sie betreibt, konfiguriert einen in der Kompositionsdatei.',
  refusedHint: 'Ihr Konto verwaltet hier nichts, daher gibt es nichts anzuzeigen. Wenden Sie sich an die Administration dieser Installation.',
}

/** ru copy. */
export const ru: Record<AdminConsoleKey, string> = {
  console: 'Администрирование',
  workbench: 'Открыть рабочее место',
  group_organization: 'Организация и люди',
  group_capability: 'Доступ и возможности',
  group_platform: 'Данные и платформа',
  group_other: 'Прочее',
  empty: 'В этом развёртывании не собрано ни одной страницы администрирования.',
  emptyHint: 'Выберите нужные модули — учётные записи, квоты, управление моделями — и их страницы появятся здесь.',
  signedInAs: 'Вошли как {name}',
  signOut: 'Выйти',
  nobody: 'Никто не вошёл',
  refused: 'Эта страница для администраторов.',
  signInTitle: 'Войдите, чтобы администрировать это развёртывание',
  signInHint: 'Консоль — для тех, кому это развёртывание её доверяет. Выберите способ входа.',
  signInNoChannel: 'В этом развёртывании ещё не настроен ни один канал входа, поэтому войти никто не может. Тот, кто его развернул, настраивает канал в файле композиции.',
  refusedHint: 'Ваша учётная запись здесь ничем не управляет, поэтому показывать нечего. Обратитесь к администратору этого развёртывания.',
}

/** pt copy. */
export const pt: Record<AdminConsoleKey, string> = {
  console: 'Administração',
  workbench: 'Abrir a área de trabalho',
  group_organization: 'Organização e pessoas',
  group_capability: 'Acesso e recursos',
  group_platform: 'Dados e plataforma',
  group_other: 'Outros',
  empty: 'Esta implantação não compôs nenhuma página de administração.',
  emptyHint: 'Selecione os módulos cujas páginas você precisa — contas, créditos, governança de modelos — e elas aparecerão aqui.',
  signedInAs: 'Conectado como {name}',
  signOut: 'Sair',
  nobody: 'Ninguém conectado',
  refused: 'Esta página é para administradores.',
  signInTitle: 'Entre para administrar esta implantação',
  signInHint: 'O console é para as pessoas em quem esta instalação confia. Escolha como entrar.',
  signInNoChannel: 'Esta implantação ainda não configurou nenhum canal de entrada, então ninguém consegue entrar. Quem a implantou configura um no arquivo de composição.',
  refusedHint: 'Sua conta não administra nada aqui, então não há nada a mostrar. Fale com quem administra esta instalação.',
}
