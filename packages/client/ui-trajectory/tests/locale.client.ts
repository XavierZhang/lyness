import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { en, zh, type TrajectoryTranslate } from '../src/client/locales.ts'

/** English trajectory translator for component and pure-layout tests. */
export const t: TrajectoryTranslate = makeTranslate(en, commonEn)

/** Chinese trajectory translator for real-view fixtures that open in Chinese. */
export const tZh: TrajectoryTranslate = makeTranslate(zh, commonZh)
