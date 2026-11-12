const counts = new Map<string, number>()

/** An id that starts with `prefix` and is not yet used in the document. */
export function newId(doc: Document, prefix: string): string {
  let id: string
  do {
    const n = (counts.get(prefix) ?? 0) + 1
    counts.set(prefix, n)
    id = `${prefix}-${n}`
  } while (doc.getElementById(id))
  return id
}

/** A line-and-dot sign, hidden from assistive technology. */
export function sign(doc: Document, className = '', style?: string): HTMLElement {
  const el = doc.createElement('i')
  el.className = className ? `ban-ln ${className}` : 'ban-ln'
  el.setAttribute('aria-hidden', 'true')
  if (style) el.setAttribute('style', style)
  return el
}
