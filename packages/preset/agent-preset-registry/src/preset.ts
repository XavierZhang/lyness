import type { Volatile } from '@deepseek-ai/cordis'
/** Public preset roster and selection configuration. */
/** One declared preset and its current activation failure, if any. */
export interface AgentPreset {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly order?: number
  /**
   * Whether a person starting a task is offered this preset. Absent means
   * offered.
   *
   * A preset that is not offered still resolves and still mounts: a session
   * recorded under its id has to reopen, and an administration surface still
   * lists it. Only the chooser a person uses leaves it out.
   */
  readonly offered?: boolean
  readonly broken?: string
}

/** Registry selection policy. */
export interface Config {
  /** Deployment default when the caller omits a preset. */
  default: string
  /** User-selected default; edited through Settings. */
  selectedDefault: Volatile<string | undefined>
}
