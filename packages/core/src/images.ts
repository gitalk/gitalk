import { GitalkImageUploadError } from './types'
import type { GitalkUploadedImage } from './types'

/**
 * Pure helpers behind pluggable image upload: URL vetting, alt escaping,
 * Markdown building, timeout/abort plumbing, and result normalisation.
 *
 * Nothing here touches the DOM or the network, which keeps the security
 * boundary small: a host callback can return any string it likes, but only the
 * validated URL survives into the draft, and only this module builds the
 * Markdown around it.
 */

/** Longest accepted image URL. Longer strings are almost certainly accidents. */
export const IMAGE_URL_MAX_LENGTH = 4096

/**
 * True when `url` is safe to put in a Markdown image destination.
 *
 * Only absolute `http(s)` URLs pass. That deliberately excludes:
 *  - `data:` (GitHub strips the whole `src`),
 *  - `blob:` (only valid in the page that created it),
 *  - `javascript:` and friends,
 *  - relative paths (the comment has no reliable base),
 *  - URLs carrying a username/password, and
 *  - anything longer than {@link IMAGE_URL_MAX_LENGTH}.
 */
export function isAcceptableUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false

  const value = url.trim()
  if (!value || value.length > IMAGE_URL_MAX_LENGTH) return false
  // Control characters cannot appear in a Markdown destination and are a
  // classic way to smuggle a second line into the draft.
  if (/[\u0000-\u001f\u007f]/.test(value)) return false

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    // Relative paths and protocol-relative URLs throw without a base.
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  return true
}

/**
 * Escape alt text so it cannot terminate the `![...]` label or inject HTML.
 *
 * Newlines become spaces because an image label is a single line; backslashes,
 * brackets and angle brackets are escaped so a file name can never break out
 * of the alt slot.
 */
export function escapeMarkdownAlt(alt: string): string {
  return String(alt)
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\[\]<>])/g, '\\$1')
}

/**
 * Build the Markdown for one uploaded image.
 *
 * A destination containing whitespace or parentheses is wrapped in `<...>`,
 * which is what CommonMark expects for such URLs. Angle brackets that could
 * terminate that wrapper are percent-encoded first.
 */
export function buildImageMarkdown(image: GitalkUploadedImage): string {
  const alt = escapeMarkdownAlt(image.alt ?? '')
  const url = String(image.url ?? '').trim()
  const safe = url.replace(/</g, '%3C').replace(/>/g, '%3E')
  const destination = /[\s()]/.test(safe) ? `<${safe}>` : safe
  return `![${alt}](${destination})`
}

export interface WithTimeoutOptions {
  /** Abort the wait when the visitor cancels or the widget unmounts. */
  signal?: AbortSignal
  /** Original selection, attached to the rejection for "retry". */
  files?: File[]
  /** Called after a timeout rejection, typically `() => controller.abort()`. */
  onTimeout?: () => void
}

/**
 * Race `work` against a timeout and an abort signal.
 *
 * `timeoutMs <= 0` disables the timeout while still honouring `signal`. The
 * returned promise settles exactly once: an abort or timeout wins even if the
 * underlying handler later resolves, which is what makes "late result after
 * cancel" harmless.
 */
export function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  options: WithTimeoutOptions = {}
): Promise<T> {
  const { signal, files = [], onTimeout } = options

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener('abort', handleAbort)
    }

    const finish = (settle: (value: never) => void, value: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      settle(value as never)
    }

    function handleAbort() {
      finish(reject, new GitalkImageUploadError('aborted', files))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    signal?.addEventListener('abort', handleAbort, { once: true })

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return
        finish(reject, new GitalkImageUploadError('timeout', files))
        try {
          onTimeout?.()
        } catch (err) {
          console.warn('gitalk: upload abort callback threw', err)
        }
      }, timeoutMs)
    }

    work.then(
      (value) => finish(resolve, value),
      (err) => finish(reject, err)
    )
  })
}

/**
 * Validate and normalise a handler's return value.
 *
 * One entry is required per selected file, in the same order. A plain string
 * stands for `{ url }` and inherits the file's name as alt text. Anything
 * short, long, malformed or non-http(s) rejects the WHOLE batch: the widget
 * inserts Markdown atomically, never half of a selection.
 */
export function normalizeUploadResult(
  result: Array<GitalkUploadedImage | string>,
  files: File[]
): GitalkUploadedImage[] {
  if (!Array.isArray(result) || result.length !== files.length) {
    const actual = Array.isArray(result) ? result.length : 0
    throw new GitalkImageUploadError(
      'count-mismatch',
      files,
      new Error(`expected ${files.length} uploaded image(s), got ${actual}`)
    )
  }

  return result.map((item, index) => {
    const fallbackAlt = files[index]?.name || 'image'
    const url = typeof item === 'string' ? item : item?.url
    if (!isAcceptableUrl(url)) {
      throw new GitalkImageUploadError('invalid-url', files, new Error(String(url ?? item)))
    }

    const alt =
      typeof item === 'object' && item !== null && typeof item.alt === 'string' && item.alt.trim()
        ? item.alt.trim()
        : fallbackAlt
    return { url: url.trim(), alt }
  })
}
