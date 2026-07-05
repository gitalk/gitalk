import arrowDown from '../assets/icon/arrow_down.svg?raw'
import edit from '../assets/icon/edit.svg?raw'
import github from '../assets/icon/github.svg?raw'
import heart from '../assets/icon/heart.svg?raw'
import heartOn from '../assets/icon/heart_on.svg?raw'
import reply from '../assets/icon/reply.svg?raw'
import tip from '../assets/icon/tip.svg?raw'

const icons: Record<string, string> = {
  arrow_down: arrowDown,
  edit,
  github,
  heart,
  heart_on: heartOn,
  reply,
  tip,
}

export type IconName = keyof typeof icons

interface SvgProps {
  className?: string
  name: IconName
  text?: string | number
}

export default function Svg({ className = '', name, text }: SvgProps) {
  return (
    <span className={`gt-ico ${className}`}>
      <span className="gt-svg" dangerouslySetInnerHTML={{ __html: icons[name] ?? '' }} />
      {text ? <span className="gt-ico-text">{text}</span> : null}
    </span>
  )
}
