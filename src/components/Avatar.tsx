import githubIcon from '../assets/icon/github.svg?raw'

// v1 兜底头像指向 jsdelivr 的仓库源码路径，v2 不再发布 src 目录，改为内联 data URI
const DEFAULT_AVATAR = `data:image/svg+xml,${encodeURIComponent(githubIcon)}`

interface AvatarProps {
  src?: string | null
  className?: string
  alt?: string
  defaultSrc?: string
}

export default function Avatar({
  src,
  className = '',
  alt = '',
  defaultSrc = DEFAULT_AVATAR,
}: AvatarProps) {
  return (
    <div className={`gt-avatar ${className}`}>
      <img
        src={src || defaultSrc}
        alt={`@${alt}`}
        onError={(e) => {
          ;(e.target as HTMLImageElement).src = defaultSrc
        }}
      />
    </div>
  )
}
