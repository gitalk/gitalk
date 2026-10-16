import type { ComponentChildren } from 'preact'
import { icons, type IconName } from '../icons'

interface IconProps {
  name: IconName
  className?: string
  text?: ComponentChildren
}

export function Icon({ name, className, text }: IconProps) {
  return (
    <span className={`gt-ico ${className ?? ''}`}>
      <span className="gt-svg" dangerouslySetInnerHTML={{ __html: icons[name] }} />
      {text ? <span className="gt-ico-text">{text}</span> : null}
    </span>
  )
}
