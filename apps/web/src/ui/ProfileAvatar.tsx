import { useState } from 'react'
import './profile-avatar.css'

export function ProfileAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState<string>()
  return (
    <span className="profile-avatar" aria-hidden="true">
      {src && failed !== src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <span>{name.trim().slice(0, 1).toLocaleUpperCase() || 'H'}</span>
      )}
    </span>
  )
}
