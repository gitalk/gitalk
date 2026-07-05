interface ActionProps {
  className?: string
  onClick?: (e: MouseEvent) => void
  text: string
}

export default function Action({ className = '', onClick, text }: ActionProps) {
  return (
    <a className={`gt-action ${className}`} onClick={onClick}>
      <span className="gt-action-text">{text}</span>
    </a>
  )
}
