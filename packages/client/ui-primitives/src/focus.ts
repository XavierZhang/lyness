/** Focus presentation for automatic entry and restoration. */
const releases = new WeakMap<HTMLElement, () => void>()
const navigationKeys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])

/**
 * Focus an automatic destination without a focus outline until keyboard navigation or blur.
 * The theme suppresses outlines while data-dsh-automatic-focus is present; borders and shadows remain intact.
 * Tab and directional navigation restore normal focus styling.
 * @param element - control or container receiving automatic focus.
 * @param options - browser focus options, including scroll preservation.
 */
export function focusWithoutRing(element: HTMLElement, options?: FocusOptions): void {
  releases.get(element)?.()
  const release = (): void => {
    element.removeAttribute('data-dsh-automatic-focus')
    element.removeEventListener('blur', release)
    element.removeEventListener('keydown', navigate, true)
    releases.delete(element)
  }
  const navigate = (event: KeyboardEvent): void => {
    if (!event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey && navigationKeys.has(event.key)) release()
  }
  releases.set(element, release)
  element.setAttribute('data-dsh-automatic-focus', '')
  element.addEventListener('blur', release)
  element.addEventListener('keydown', navigate, true)
  element.focus(options)
  if (!element.matches(':focus')) release()
}

/**
 * Keep keyboard focus inside a reader while Tab moves through its controls.
 *
 * A reader is a dialog, so Tab leaving it would land on the page behind one
 * that cannot be seen. Hidden panels are skipped because a tabbed reader
 * keeps the inactive panels in the tree.
 * @param event - keyboard event from the active reader.
 */
export function trapReaderTab(event: ReaderKeyboardEvent): void {
  if (event.key !== 'Tab') return
  const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
  )).filter(element => !element.closest('[hidden]'))
  const first = targets[0]
  const last = targets[targets.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

/** The part of a keyboard event this trap reads, so it takes React's and the DOM's alike. */
export interface ReaderKeyboardEvent {
  /** The key that was pressed. */
  readonly key: string
  /** Whether Shift was held, which reverses the direction. */
  readonly shiftKey: boolean
  /** The reader the handler is attached to. */
  readonly currentTarget: HTMLElement
  /** Stops the browser moving focus out of the reader. */
  preventDefault: () => void
}
