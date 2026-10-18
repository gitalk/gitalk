/**
 * Literal snippets that appear in the copy.
 *
 * They are language-independent, so they live here instead of being retyped in
 * eleven dictionaries: every locale's FAQ first answer references `CDN_SCRIPT`
 * verbatim, which is what keeps the snippet byte-identical when someone edits a
 * translation. `string` is spelled out so the constant stays assignable to the
 * dictionaries' `code` fields rather than narrowing to its literal type.
 */
export const CDN_SCRIPT: string =
  '<script src="https://cdn.jsdelivr.net/npm/@aifire/gitalk@latest/dist/gitalk.js"></script>'
