import { useEffect, useState } from 'react'
import { getProfileImageContent } from '../../api/client'
import { getInitials } from '../../auth/authUtils'
import './profile-avatar.css'

type ProfileAvatarProps = {
  fullName: string
  profileImageUrl?: string | null
  size?: 'sm' | 'lg'
  testId?: string
}

export function ProfileAvatar({
  fullName,
  profileImageUrl,
  size = 'sm',
  testId,
}: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const className = size === 'lg' ? 'profile-avatar profile-avatar-lg' : 'profile-avatar'

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    setImageFailed(false)
    setImageSrc(null)
    if (!profileImageUrl) {
      return () => undefined
    }

    void getProfileImageContent(profileImageUrl)
      .then((image) => {
        if (!active) {
          return
        }
        objectUrl = URL.createObjectURL(image)
        setImageSrc(objectUrl)
      })
      .catch(() => {
        if (active) {
          setImageFailed(true)
        }
      })

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [profileImageUrl])

  if (imageSrc && !imageFailed) {
    return (
      <img
        src={imageSrc}
        alt=""
        className={`${className} profile-avatar-image`}
        data-testid={testId}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span className={className} dir="auto" data-testid={testId ?? 'profile-image-initials'}>
      {getInitials(fullName)}
    </span>
  )
}
