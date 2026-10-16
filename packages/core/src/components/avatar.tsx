import { GHOST_USER } from '../api/backend'

interface AvatarProps {
  src?: string
  alt?: string
  className?: string
}

export function Avatar({ src, alt, className }: AvatarProps) {
  return (
    <div className={`gt-avatar ${className ?? ''}`}>
      <img
        src={src || GHOST_USER.avatarUrl}
        alt={alt ? `@${alt}` : ''}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          if (img.src !== GHOST_USER.avatarUrl) img.src = GHOST_USER.avatarUrl
        }}
      />
    </div>
  )
}
