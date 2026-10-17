import { useRef } from 'preact/hooks'
import type { Translator } from '../i18n'
import type { GitalkImageUploadError } from '../types'
import { Icon } from './icon'

/**
 * Image-upload controls.
 *
 * Gitalk ships no storage backend, so these components only collect files and
 * render the progress/error states around the host's `onUploadImage` handler.
 * Keeping the button and the error row separate lets the widget put the button
 * in `.gt-header-controls` and the `role="alert"` line directly below it.
 */

export interface ImageUploadProgress {
  loaded: number
  total: number
}

interface ImageUploadButtonProps {
  uploading: boolean
  progress: ImageUploadProgress | null
  /** Button label when idle, e.g. "Upload image". */
  label: string
  /** Button label while busy, e.g. "Uploading…". */
  uploadingLabel: string
  /** Label of the separate cancel control shown while busy. */
  cancelLabel: string
  onFiles: (files: File[]) => void
  onCancel: () => void
}

export function ImageUploadButton({
  uploading,
  progress,
  label,
  uploadingLabel,
  cancelLabel,
  onFiles,
  onCancel
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const percent =
    progress && Number.isFinite(progress.total) && progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((progress.loaded / progress.total) * 100)))
      : null

  return (
    <>
      <button
        type="button"
        className="gt-btn gt-btn-upload-image"
        title={uploading ? uploadingLabel : label}
        aria-label={uploading ? uploadingLabel : label}
        aria-busy={uploading ? 'true' : undefined}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Icon className="gt-ico-image" name="image" />
        <span className="gt-btn-text">{uploading ? uploadingLabel : label}</span>
        {uploading && percent !== null ? (
          <span className="gt-image-progress">{percent}%</span>
        ) : null}
      </button>

      {uploading ? (
        <button
          type="button"
          className="gt-btn gt-btn-upload-cancel"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      ) : null}

      <input
        ref={inputRef}
        className="gt-image-input"
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const input = e.currentTarget
          // Capture before clearing: resetting `value` empties the FileList but
          // keeps the same files selectable twice in a row.
          const files = Array.from(input.files ?? [])
          input.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </>
  )
}

interface ImageUploadErrorProps {
  error: GitalkImageUploadError
  t: Translator
  onRetry: () => void
}

/**
 * Failure line shown directly below `.gt-header-controls`.
 *
 * Cancellation is deliberately never rendered: the visitor asked for it, and
 * the upload action swallows that one code. Everything else names the reason
 * and offers a retry with the original `File[]` (carried on `error.files`).
 */
export function ImageUploadError({ error, t, onRetry }: ImageUploadErrorProps) {
  return (
    <div className="gt-image-error" role="alert">
      <span className="gt-image-error-text">{imageUploadErrorMessage(t, error)}</span>
      <button type="button" className="gt-btn gt-btn-upload-retry" onClick={onRetry}>
        {t('retry-upload')}
      </button>
    </div>
  )
}

/** Localised reason for an upload failure, with the handler's detail appended. */
export function imageUploadErrorMessage(t: Translator, error: GitalkImageUploadError): string {
  if (error.code === 'invalid-url') return t('image-invalid-url')
  if (error.code === 'timeout') return t('image-upload-timeout')
  if (error.code === 'aborted') return t('image-upload-cancelled')

  const base = t('image-upload-failed')
  const detail = error.cause instanceof Error ? error.cause.message : ''
  return detail ? `${base}: ${detail}` : base
}
