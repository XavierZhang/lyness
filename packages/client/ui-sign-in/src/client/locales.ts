/**
 * Copy for the sign-in screen and the row that names who is signed in.
 *
 * @module @deepseek-ai/dsh-client-ui-sign-in/client/locales
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
