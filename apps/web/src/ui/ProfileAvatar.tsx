import { useState } from 'react'
import './profile-avatar.css'

export function ProfileAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState<string>()
  const [loaded, setLoaded] = useState<string>()
  return (
    <span className="profile-avatar" aria-hidden="true">
      <span>{name.trim().slice(0, 1).toLocaleUpperCase() || 'H'}</span>
      {src && failed !== src && (
        <img
          key={src}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          data-ready={loaded === src}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      )}
    </span>
  )
}
