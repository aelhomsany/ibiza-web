/**
 * Bidirectional-text helpers for user-entered data.
 *
 * Names, team names, leave types and free-text notes are typed by people and are
 * never translated with the UI — they render in whatever language they were
 * entered in. That means a string of either script can land inside a sentence of
 * the other, and the surrounding text's direction will otherwise capture any
 * neutral characters (spaces, punctuation, parentheses) touching it.
 *
 * Two tools, used in different places:
 *
 * - Rendering a value on its own → put `dir="auto"` on the element (or use
 *   `<bdi>`, which is `dir="auto"` plus isolation). The element then takes its
 *   direction from the value's own first strong character.
 * - Interpolating a value into a translated sentence → wrap it with `isolate()`
 *   below. `dir` cannot help there, because the element's first strong character
 *   comes from the translated text rather than from the value.
 */

/** First strong isolate — opens a run whose direction is detected from its content. */
const FSI = '⁨'
/** Pop directional isolate — closes the run opened by FSI. */
const PDI = '⁩'

/**
 * Wrap a value so it keeps its own direction inside a sentence of the other
 * script, and so neutral characters next to it are not reordered.
 *
 * Without this, an Arabic sentence ending in an interpolated English name can
 * render its full stop at the wrong end of the line.
 *
 * Not for i18next `count` values, which must stay numeric for plural selection.
 */
export function isolate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  return `${FSI}${value}${PDI}`
}
