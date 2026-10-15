// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { trapReaderTab } from '../src/focus.ts'

afterEach(() => { document.body.innerHTML = '' })

/** A reader holding three controls, the middle one inside a hidden panel. */
function reader(): { element: HTMLElement; first: HTMLElement; last: HTMLElement } {
  document.body.innerHTML = `
    <div id="reader">
      <button id="first">first</button>
      <div hidden><button id="hidden-one">hidden</button></div>
      <button id="last">last</button>
      <button id="disabled" disabled>disabled</button>
    </div>`
  const element = document.getElementById('reader') as HTMLElement
  return {
    element,
    first: document.getElementById('first') as HTMLElement,
    last: document.getElementById('last') as HTMLElement,
  }
}

/** One Tab press on the reader, with the focus wherever the test put it. */
function press(element: HTMLElement, shiftKey: boolean, key = 'Tab'): () => void {
  const preventDefault = vi.fn()
  trapReaderTab({ key, shiftKey, currentTarget: element, preventDefault })
  return preventDefault
}

describe('trapReaderTab', () => {
  it('wraps from the last control to the first', () => {
    const { element, first, last } = reader()
    last.focus()
    const prevented = press(element, false)
    expect(prevented).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(first)
  })

  it('wraps backwards from the first control to the last', () => {
    const { element, first, last } = reader()
    first.focus()
    const prevented = press(element, true)
    expect(prevented).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(last)
  })

  it('leaves a move that stays inside the reader to the browser', () => {
    const { element, first } = reader()
    first.focus()
    // Forward from the first control is not the wrap case, so the handler must
    // not preventDefault and must not move the focus itself.
    const prevented = press(element, false)
    expect(prevented).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(first)
  })

  it('ignores every key but Tab', () => {
    const { element, last } = reader()
    last.focus()
    const prevented = press(element, false, 'Enter')
    expect(prevented).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(last)
  })

  it('skips controls inside a hidden panel, which a tabbed reader keeps mounted', () => {
    const { element, first, last } = reader()
    last.focus()
    press(element, false)
    // The hidden button sits between the two, so reaching `first` proves it
    // was not treated as the wrap target.
    expect(document.activeElement).toBe(first)
  })

  it('does nothing in a reader with no controls', () => {
    document.body.innerHTML = '<div id="reader"><p>nothing to focus</p></div>'
    const element = document.getElementById('reader') as HTMLElement
    const prevented = press(element, false)
    expect(prevented).not.toHaveBeenCalled()
  })
})
