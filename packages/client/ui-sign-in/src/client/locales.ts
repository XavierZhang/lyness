/**
 * Copy for the sign-in screen and the row that names who is signed in.
 *
 * @module @lyness/lyn-client-ui-sign-in/client/locales
 */

/** English copy; the key set every locale answers. */
export const en = {
  title: 'Sign in',
  intro: 'This deployment serves named people. Choose how to sign in.',
  loading: 'Checking who you are…',
  failed: 'This deployment could not be reached. Please try again.',
  retry: 'Try again',
  noChannels: 'This deployment has accounts but offers no way to sign in yet. Ask whoever runs it to add one.',
  signInWith: 'Continue with {channel}',
  row: 'Signed in',
  anonymous: 'Not signed in',
  signOut: 'Sign out',
  rolePlatformAdministrator: 'Platform administrator',
  roleTenantAdministrator: 'Administrator of {organization}',
  roleMember: 'Member of {organization}',
  roleAdministratorPlain: 'Administrator',
  roleMemberPlain: 'Member',
  rolePersonal: 'Personal',
} as const

/** Key set of the sign-in dictionaries. */
export type SignInKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<SignInKey, string> = {
  title: '登录',
  intro: '这套部署服务的是有名有姓的人。请选择登录方式。',
  loading: '正在确认你是谁……',
  failed: '暂时无法连接这套部署，请重试。',
  retry: '重试',
  noChannels: '这套部署有账户，但还没有提供任何登录方式。请找运维它的人加一个。',
  signInWith: '使用{channel}继续',
  row: '已登录',
  anonymous: '未登录',
  signOut: '退出登录',
  rolePlatformAdministrator: '平台管理员',
  roleTenantAdministrator: '{organization} 的管理员',
  roleMember: '{organization} 的成员',
  roleAdministratorPlain: '管理员',
  roleMemberPlain: '成员',
  rolePersonal: '个人',
}

/** Japanese copy. */
export const ja: Record<SignInKey, string> = {
  title: 'サインイン',
  intro: 'このデプロイは名のある人々に向けたものです。サインイン方法を選んでください。',
  loading: 'あなたが誰かを確認しています…',
  failed: 'このデプロイに接続できませんでした。もう一度お試しください。',
  retry: '再試行',
  noChannels: 'このデプロイにはアカウントがありますが、サインイン方法がまだ用意されていません。運用している人に追加を依頼してください。',
  signInWith: '{channel} で続行',
  row: 'サインイン済み',
  anonymous: '未サインイン',
  signOut: 'サインアウト',
  rolePlatformAdministrator: 'プラットフォーム管理者',
  roleTenantAdministrator: '{organization} の管理者',
  roleMember: '{organization} のメンバー',
  roleAdministratorPlain: '管理者',
  roleMemberPlain: 'メンバー',
  rolePersonal: '個人',
}

/** Spanish copy. */
export const es: Record<SignInKey, string> = {
  title: 'Iniciar sesión',
  intro: 'Este despliegue atiende a personas con nombre. Elija cómo iniciar sesión.',
  loading: 'Comprobando quién es usted…',
  failed: 'No se pudo contactar con este despliegue. Vuelva a intentarlo.',
  retry: 'Intentar de nuevo',
  noChannels: 'Este despliegue tiene cuentas pero aún no ofrece forma de iniciar sesión. Pida a quien lo administra que añada una.',
  signInWith: 'Continuar con {channel}',
  row: 'Sesión iniciada',
  anonymous: 'Sin sesión',
  signOut: 'Cerrar sesión',
  rolePlatformAdministrator: 'Administrador de la plataforma',
  roleTenantAdministrator: 'Administrador de {organization}',
  roleMember: 'Miembro de {organization}',
  roleAdministratorPlain: 'Administrador',
  roleMemberPlain: 'Miembro',
  rolePersonal: 'Personal',
}

/** French copy. */
export const fr: Record<SignInKey, string> = {
  title: 'Connexion',
  intro: 'Ce déploiement s’adresse à des personnes nommées. Choisissez un mode de connexion.',
  loading: 'Vérification de votre identité…',
  failed: 'Ce déploiement n’a pas pu être joint. Veuillez réessayer.',
  retry: 'Réessayer',
  noChannels: 'Ce déploiement a des comptes mais n’offre encore aucun mode de connexion. Demandez à son administrateur d’en ajouter un.',
  signInWith: 'Continuer avec {channel}',
  row: 'Connecté',
  anonymous: 'Non connecté',
  signOut: 'Se déconnecter',
  rolePlatformAdministrator: 'Administrateur de la plateforme',
  roleTenantAdministrator: 'Administrateur de {organization}',
  roleMember: 'Membre de {organization}',
  roleAdministratorPlain: 'Administrateur',
  roleMemberPlain: 'Membre',
  rolePersonal: 'Personnel',
}

/** German copy. */
export const de: Record<SignInKey, string> = {
  title: 'Anmelden',
  intro: 'Diese Installation bedient namentlich bekannte Personen. Wählen Sie eine Anmeldeart.',
  loading: 'Es wird geprüft, wer Sie sind…',
  failed: 'Diese Installation war nicht erreichbar. Bitte erneut versuchen.',
  retry: 'Erneut versuchen',
  noChannels: 'Diese Installation hat Konten, bietet aber noch keine Anmeldeart. Bitten Sie die betreibende Person, eine hinzuzufügen.',
  signInWith: 'Mit {channel} fortfahren',
  row: 'Angemeldet',
  anonymous: 'Nicht angemeldet',
  signOut: 'Abmelden',
  rolePlatformAdministrator: 'Plattformadministrator',
  roleTenantAdministrator: 'Administrator von {organization}',
  roleMember: 'Mitglied von {organization}',
  roleAdministratorPlain: 'Administrator',
  roleMemberPlain: 'Mitglied',
  rolePersonal: 'Persönlich',
}

/** Russian copy. */
export const ru: Record<SignInKey, string> = {
  title: 'Вход',
  intro: 'Это развёртывание обслуживает названных людей. Выберите способ входа.',
  loading: 'Проверяем, кто вы…',
  failed: 'Не удалось связаться с этим развёртыванием. Попробуйте снова.',
  retry: 'Попробовать снова',
  noChannels: 'В этом развёртывании есть учётные записи, но способа войти пока нет. Попросите того, кто им управляет, добавить его.',
  signInWith: 'Продолжить через {channel}',
  row: 'Вы вошли',
  anonymous: 'Вход не выполнен',
  signOut: 'Выйти',
  rolePlatformAdministrator: 'Администратор платформы',
  roleTenantAdministrator: 'Администратор {organization}',
  roleMember: 'Участник {organization}',
  roleAdministratorPlain: 'Администратор',
  roleMemberPlain: 'Участник',
  rolePersonal: 'Личный',
}

/** Portuguese copy. */
export const pt: Record<SignInKey, string> = {
  title: 'Iniciar sessão',
  intro: 'Esta instalação serve pessoas nomeadas. Escolha como iniciar sessão.',
  loading: 'A confirmar quem é…',
  failed: 'Não foi possível contactar esta instalação. Tente novamente.',
  retry: 'Tentar novamente',
  noChannels: 'Esta instalação tem contas mas ainda não oferece forma de iniciar sessão. Peça a quem a administra para adicionar uma.',
  signInWith: 'Continuar com {channel}',
  row: 'Sessão iniciada',
  anonymous: 'Sem sessão',
  signOut: 'Terminar sessão',
  rolePlatformAdministrator: 'Administrador da plataforma',
  roleTenantAdministrator: 'Administrador de {organization}',
  roleMember: 'Membro de {organization}',
  roleAdministratorPlain: 'Administrador',
  roleMemberPlain: 'Membro',
  rolePersonal: 'Pessoal',
}
