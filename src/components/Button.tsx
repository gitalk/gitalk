import type { Ref } from 'preact'

interface ButtonProps {
  className?: string
  getRef?: Ref<HTMLButtonElement>
  onClick?: (e: MouseEvent) => void
  onMouseDown?: (e: MouseEvent) => void
  text: string
  isLoading?: boolean
}

export default function Button({
  className = '',
  getRef,
  onClick,
  onMouseDown,
  text,
  isLoading,
}: ButtonProps) {
  return (
    <button
      ref={getRef}
      className={`gt-btn ${className}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <span className="gt-btn-text">{text}</span>
      {isLoading && <span className="gt-btn-loading gt-spinner" />}
    </button>
  )
}
