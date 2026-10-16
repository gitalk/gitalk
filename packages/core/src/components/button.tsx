import type { ComponentChildren } from 'preact'
import type { TargetedMouseEvent } from 'preact'

interface ButtonProps {
  className?: string
  onClick?: (e: TargetedMouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  loading?: boolean
  children?: ComponentChildren
}

export function Button({ className, onClick, disabled, loading, children }: ButtonProps) {
  return (
    <button
      type="button"
      className={`gt-btn ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      <span className="gt-btn-text">{children}</span>
      {loading ? <span className="gt-btn-loading gt-spinner" /> : null}
    </button>
  )
}
