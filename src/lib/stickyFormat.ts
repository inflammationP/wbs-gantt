/**
 * Text formatting for sticky notes.
 *
 * The format is tiny — bold, a size, a colour — but the text lives in a
 * contenteditable, and `execCommand` replaces the nodes it touches: the
 * selection is lost, and a new `<font size>` lands inside the old one, which
 * keeps the line box of the old size. These helpers do the rewrite directly.
 * The selection is remembered as character offsets, because the nodes it
 * points at do not survive the rewrite; the text itself does, so the offsets
 * still name it afterwards.
 */

import { hexColor } from './sticky'

export interface Offsets {
  start: number
  end: number
}

/** A text node that contains only zero-width formatting carriers. */
const zeroWidthOnly = (text: Text) => text.data.replace(/​/g, '') === ''

/**
 * The first text node with visible characters that a range covers.
 *
 * A range can start at an element boundary, and an invisible zero-width
 * carrier can sit there. Reading the formatting at either would report the
 * carrier's or the editor's state instead of the selected words', which is how
 * a selection used to light the bold button from a leftover carrier.
 */
export function firstTextNode(range: Range): Node {
  const container = range.startContainer
  if (container.nodeType === Node.TEXT_NODE && !zeroWidthOnly(container as Text)) {
    return container
  }
  const start =
    container.nodeType === Node.TEXT_NODE
      ? container
      : container.childNodes[range.startOffset] ?? container
  if (start.nodeType === Node.TEXT_NODE && !zeroWidthOnly(start as Text)) return start
  const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (!zeroWidthOnly(node as Text)) return node
    node = walker.nextNode()
  }
  // Nothing visible ahead: read the context at the boundary itself.
  return start.nodeType === Node.ELEMENT_NODE ? start : start.parentNode ?? start
}

/** Where a range sits in its editor, as character offsets over the text. */
export function offsetsOf(editor: HTMLElement, range: Range): Offsets | null {
  try {
    const probe = document.createRange()
    probe.selectNodeContents(editor)
    probe.setEnd(range.startContainer, range.startOffset)
    const start = probe.toString().length
    probe.setEnd(range.endContainer, range.endOffset)
    return { start, end: probe.toString().length }
  } catch {
    return null
  }
}

/**
 * Put the selection back over the characters at `offsets`.
 *
 * Empty text nodes are skipped when locating a position: a rewrite can leave
 * one at the boundary, and anchoring the selection there would make the
 * toolbar read the editor's own formatting instead of the words'. The offsets
 * count text characters, so the empty node contributes nothing to skip either.
 */
export function selectOffsets(editor: HTMLElement, offsets: Offsets): boolean {
  const texts: Text[] = []
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if ((node as Text).data.length > 0) texts.push(node as Text)
    node = walker.nextNode()
  }
  const locate = (at: number): { node: Node; offset: number } => {
    let pos = 0
    for (const text of texts) {
      if (at <= pos + text.data.length) return { node: text, offset: Math.max(0, at - pos) }
      pos += text.data.length
    }
    // Past the end (or an empty editor): the editor itself is the boundary.
    return { node: editor, offset: editor.childNodes.length }
  }
  const from = locate(offsets.start)
  const to = locate(offsets.end)
  const sel = window.getSelection()
  if (!sel) return false
  const range = document.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

function weightOf(element: Element | null): number {
  if (!element) return 400
  const weight = window.getComputedStyle(element).fontWeight
  if (weight === 'bold' || weight === 'bolder') return 700
  if (weight === 'lighter') return 300
  const n = Number(weight)
  return Number.isFinite(n) ? n : 400
}

/** Visible text nodes under a node, ignoring zero-width carriers. */
function visibleTexts(root: Node): Text[] {
  if (root.nodeType === Node.TEXT_NODE) {
    return zeroWidthOnly(root as Text) ? [] : [root as Text]
  }
  const out: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (!zeroWidthOnly(text)) out.push(text)
  }
  return out
}

/**
 * The element whose weight the caret types with.
 *
 * At an element boundary the visible text on either side decides, not the
 * zero-width carrier sitting exactly at the caret — a stale carrier's normal
 * weight is what made the bold button switch off as the caret moved.
 */
function caretElement(range: Range, editor: HTMLElement): Element | null {
  const node = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    return parent && editor.contains(parent) ? parent : editor
  }
  const element = node as Element
  for (let i = range.startOffset - 1; i >= 0; i--) {
    const texts = visibleTexts(element.childNodes[i])
    if (texts.length) return texts[texts.length - 1].parentElement ?? element
  }
  for (let i = range.startOffset; i < element.childNodes.length; i++) {
    const texts = visibleTexts(element.childNodes[i])
    if (texts.length) return texts[0].parentElement ?? element
  }
  return element
}

/** Whether the range actually takes characters from a text node. */
function selectsText(range: Range, text: Text): boolean {
  if (text === range.startContainer && text === range.endContainer) {
    return range.endOffset > range.startOffset
  }
  if (text === range.startContainer) return range.startOffset < text.data.length
  if (text === range.endContainer) return range.endOffset > 0
  return range.intersectsNode(text)
}

/**
 * Whether the selection (or the caret) is bold.
 *
 * A selection is bold only when every visible character in it is bold; a
 * half-bold range used to light the button from its first word. The caret uses
 * the visible text beside it. Both read the computed weight rather than
 * `queryCommandState`, whose state goes stale whenever the nodes are rewritten.
 */
export function selectionBold(editor: HTMLElement, range: Range): boolean {
  if (range.collapsed) return weightOf(caretElement(range, editor)) >= 600
  let any = false
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (zeroWidthOnly(text) || !selectsText(range, text)) continue
    any = true
    if (weightOf(text.parentElement) < 600) return false
  }
  if (any) return true
  const text = firstTextNode(range)
  const element =
    text.nodeType === Node.ELEMENT_NODE ? (text as Element) : text.parentElement
  return weightOf(element) >= 600
}

/** The computed text colour at the selection, as `#rrggbb`, for the toolbar. */
export function selectionColor(editor: HTMLElement, range: Range): string | null {
  const element = range.collapsed
    ? caretElement(range, editor)
    : (() => {
        const text = firstTextNode(range)
        return text.nodeType === Node.ELEMENT_NODE ? (text as Element) : text.parentElement
      })()
  return element ? hexColor(window.getComputedStyle(element).color) : null
}

/**
 * Drop nodes a rewrite emptied.
 *
 * An empty text node left at the selection boundary is enough to make the
 * toolbar read the wrong formatting; an empty `<font size>` left around the
 * text still contributes its font metrics to the line box, which keeps the
 * line spacing tall after the text has shrunk. Neither belongs in the note.
 */
export function dropEmptyNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const emptyText: Text[] = []
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.length === 0) emptyText.push(text)
  }
  emptyText.forEach((text) => text.remove())
  let again = true
  while (again) {
    again = false
    root.querySelectorAll('b, strong, i, em, u, span, font').forEach((el) => {
      if ((el.textContent ?? '').length === 0 && !el.querySelector('br')) {
        el.remove()
        again = true
      }
    })
  }
}

/** The inline wrappers the selection is written inside, outermost first. */
export function inlineChain(start: Node, root: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = []
  let node: Node | null = start
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (/^(B|STRONG|I|EM|U|SPAN|FONT)$/.test(el.tagName)) chain.unshift(el)
    }
    node = node.parentNode
  }
  return chain
}

const isEmptyInline = (el: Element) =>
  (el.textContent ?? '').length === 0 && !el.querySelector('br, img')

/**
 * Put a `<font>` around every text node in the fragment.
 *
 * Wrapping the fragment as a whole would put an inline element around block
 * elements when the selection spans lines, which is not valid HTML and makes
 * the browser restructure the note. One wrapper per text node stays inside
 * whichever block the text belongs to.
 */
export function wrapTextNodes(
  frag: DocumentFragment,
  attr: 'size' | 'color',
  value: string,
): DocumentFragment {
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.length > 0) texts.push(text)
  }
  for (const text of texts) {
    const font = document.createElement('font')
    font.setAttribute(attr, value)
    text.replaceWith(font)
    font.appendChild(text)
  }
  return frag
}

const BLOCK_TAG = /^(DIV|P|LI|UL|OL|BLOCKQUOTE|PRE|TABLE|THEAD|TBODY|TR|TD|TH|H[1-6])$/

function blockOf(node: Node, root: HTMLElement): Node | null {
  let current: Node | null = node
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE && BLOCK_TAG.test((current as Element).tagName)) {
      return current
    }
    current = current.parentNode
  }
  return null
}

/** Run `fn` on the part of every text node the range selects, split out into a
 *  node of its own. The structure around it does not move. */
function eachSelectedText(editor: HTMLElement, range: Range, fn: (node: Text) => void): void {
  const texts: Text[] = []
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const text = walker.currentNode as Text
    if (text.data.length > 0 && range.intersectsNode(text)) texts.push(text)
  }
  for (const text of texts) {
    const start = text === range.startContainer ? range.startOffset : 0
    const end = text === range.endContainer ? range.endOffset : text.data.length
    if (start >= end) continue
    let node = text
    if (start > 0) node = text.splitText(start)
    if (end - start < node.data.length) node.splitText(end - start)
    fn(node)
  }
}

/** Wrap the selected part of each text node where it already sits. */
function wrapTextInPlace(
  editor: HTMLElement,
  range: Range,
  attr: 'size' | 'color',
  value: string,
): void {
  eachSelectedText(editor, range, (node) => {
    // If an existing font around this text holds nothing else, change its
    // attribute instead of nesting a second size inside it. A leftover outer
    // size is what keeps the line box of the old size.
    const fonts: HTMLElement[] = []
    let parent: Node | null = node.parentNode
    while (parent && parent !== editor) {
      if (
        parent.nodeType === Node.ELEMENT_NODE &&
        (parent as Element).tagName === 'FONT' &&
        (parent as Element).hasAttribute(attr) &&
        (parent as Element).textContent === node.data
      ) {
        fonts.push(parent as HTMLElement)
      }
      parent = parent.parentNode
    }
    if (fonts.length > 0) {
      fonts.forEach((font) => font.setAttribute(attr, value))
      return
    }
    const font = document.createElement('font')
    font.setAttribute(attr, value)
    node.replaceWith(font)
    font.appendChild(node)
  })
}

/**
 * Put a zero-width size/colour carrier at a caret and leave the caret inside
 * it, so the next typed text inherits the attribute.
 *
 * `execCommand('insertHTML')` used to do this, but it can leave the caret
 * outside the inserted element and it never records the new caret for the next
 * toolbar press, which then acts on the old selection.
 */
/** Retarget every zero-width size carrier, so an outer one cannot keep a line
 *  box at the old size after the text has been shrunk. */
function syncSizeCarriers(editor: HTMLElement, value: string): void {
  editor.querySelectorAll('font[size]').forEach((font) => {
    if ((font.textContent ?? '').replace(/​/g, '') === '') {
      font.setAttribute('size', value)
    }
  })
}

export function insertFontCarrier(
  editor: HTMLElement,
  range: Range,
  attr: 'size' | 'color',
  value: string,
): Offsets | null {
  if (!range.collapsed) return null
  // A caret inside a zero-width carrier retargets it instead of nesting a
  // second font inside it. The old outer font would otherwise keep the line box
  // of the old size, which is what made the line spacing refuse to shrink.
  const carriers: HTMLElement[] = []
  let node: Node | null = range.startContainer
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.tagName === 'FONT' && (el.textContent ?? '').replace(/​/g, '') === '') {
        carriers.push(el)
      }
    }
    node = node.parentNode
  }
  if (carriers.length > 0) {
    carriers.forEach((carrier) => carrier.setAttribute(attr, value))
    if (attr === 'size') syncSizeCarriers(editor, value)
    return offsetsOf(editor, range)
  }
  const carrier = document.createElement('font')
  carrier.setAttribute(attr, value)
  carrier.appendChild(document.createTextNode('​'))
  range.insertNode(carrier)
  if (attr === 'size') syncSizeCarriers(editor, value)
  const text = carrier.firstChild as Text
  const after = document.createRange()
  after.setStart(text, 1)
  after.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(after)
  return offsetsOf(editor, after)
}

/**
 * Toggle bold on the selection, or on what is typed at a caret.
 *
 * Turning bold on wraps the selected text in `<b>`. Turning it off wraps it in
 * a `font-weight: normal` span instead of cutting the `<b>` out of its parent:
 * a partial selection inside a larger bold run keeps the run intact and only
 * the selected words lose the weight. A caret gets a zero-width carrier, so
 * the next typed text takes the state without the browser's typing commands.
 */
export function applyBoldToSelection(
  editor: HTMLElement,
  range: Range,
  bold: boolean,
): Offsets | null {
  if (range.collapsed) {
    const carrier = document.createElement(bold ? 'b' : 'span')
    if (!bold) carrier.setAttribute('style', 'font-weight: normal')
    carrier.appendChild(document.createTextNode('​'))
    range.insertNode(carrier)
    const text = carrier.firstChild as Text
    const after = document.createRange()
    after.setStart(text, 1)
    after.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(after)
    return offsetsOf(editor, after)
  }
  const offsets = offsetsOf(editor, range)
  const wrapper = (node: Text, match: (el: Element) => boolean): HTMLElement | null => {
    let parent = node.parentElement
    while (parent && parent !== editor) {
      if (match(parent) && (parent.textContent ?? '') === node.data) return parent
      parent = parent.parentElement
    }
    return null
  }
  eachSelectedText(editor, range, (node) => {
    const weight = weightOf(node.parentElement)
    if (bold) {
      if (weight >= 600) return
      // The normal span may be inside an outer `<b>` from an earlier unbold;
      // drop it rather than leaving another wrapper around the new `<b>`.
      const normal = wrapper(node, (el) => el.tagName === 'SPAN' && weightOf(el) < 600)
      if (normal) normal.replaceWith(...Array.from(normal.childNodes))
      const b = document.createElement('b')
      node.replaceWith(b)
      b.appendChild(node)
      return
    }
    if (weight < 600) return
    // Unwrap every bold ancestor that holds only this text — not just the
    // direct parent, which may be a `<font>` inside the `<b>`.
    let unwrapped = false
    while (true) {
      const boldEl = wrapper(node, (el) => el.tagName === 'B' || el.tagName === 'STRONG')
      if (!boldEl) break
      boldEl.replaceWith(...Array.from(boldEl.childNodes))
      unwrapped = true
    }
    if (unwrapped && weightOf(node.parentElement) < 600) return
    const span = document.createElement('span')
    span.setAttribute('style', 'font-weight: normal')
    node.replaceWith(span)
    span.appendChild(node)
  })
  if (offsets) selectOffsets(editor, offsets)
  return offsets
}

/**
 * Apply a font size or colour to a selection.
 *
 * Within one block the selected content is extracted, its old attribute is
 * removed, every text node is wrapped, and the whole thing is put back inside
 * the inline wrappers the extraction consumed — that is how a size change
 * keeps bold, and how shrinking stops the old larger font from keeping the
 * line box tall. Across blocks that extraction leaves empty `<div>`s behind
 * and puts inline wrappers around block elements, so there each selected text
 * node is split and wrapped where it already sits; the block structure does
 * not move.
 *
 * Returns the selection's offsets and re-selects them. The text is unchanged,
 * so the same offsets still name the same words.
 */
export function applyFontToSelection(
  editor: HTMLElement,
  range: Range,
  attr: 'size' | 'color',
  value: string,
): Offsets | null {
  const offsets = offsetsOf(editor, range)
  if (blockOf(range.startContainer, editor) !== blockOf(range.endContainer, editor)) {
    wrapTextInPlace(editor, range, attr, value)
  } else {
    const inherited = inlineChain(range.startContainer, editor)
    const frag = range.extractContents()
    const consumed = inherited.filter(isEmptyInline)
    dropEmptyNodes(editor)
    frag.querySelectorAll('font').forEach((font) => font.removeAttribute(attr))
    let node: Node = wrapTextNodes(frag, attr, value)
    for (let i = consumed.length - 1; i >= 0; i--) {
      const source = consumed[i]
      const clone = source.cloneNode(false) as HTMLElement
      clone.removeAttribute(attr)
      // A `<font>`/`<span>` whose only reason to exist was the attribute just
      // removed is not worth rebuilding.
      if ((clone.tagName === 'FONT' || clone.tagName === 'SPAN') && clone.attributes.length === 0) continue
      clone.appendChild(node)
      node = clone
    }
    range.insertNode(node)
    dropEmptyNodes(editor)
  }
  if (attr === 'size') syncSizeCarriers(editor, value)
  if (offsets) selectOffsets(editor, offsets)
  return offsets
}
