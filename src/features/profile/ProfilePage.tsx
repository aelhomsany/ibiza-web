import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import { ApiError, removeProfileImage, uploadProfileImage } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { formatRole } from '../../auth/authUtils'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { isSupportedLocale } from '../../i18n/documentLanguage'
import { ProfileAvatar } from './ProfileAvatar'
import '../settings/group-tabs.css'
import './profile-page.css'

export function ProfilePage() {
  const { t } = useTranslation(['layout', 'common'])
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  if (!user) {
    return null
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setIsUploading(true)
    try {
      await uploadProfileImage(file)
      await refreshUser()
      showToast('Profile photo updated.', 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? 'Unable to upload profile photo.'
          : 'Unable to upload profile photo.'
      showToast(message, 'warning')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleConfirmRemove() {
    setIsRemoving(true)
    try {
      await removeProfileImage()
      await refreshUser()
      setRemoveOpen(false)
      showToast('Profile photo removed.', 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? 'Unable to remove profile photo.'
          : 'Unable to remove profile photo.'
      showToast(message, 'warning')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="page page-wide" data-testid="profile-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile details</h1>
          <p className="page-sub">Your account information and profile photo</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="settings-card profile-summary-card" aria-label="Profile summary">
          <div className="card-section-header">
            <h2 className="card-title">Account</h2>
          </div>
          <dl className="profile-summary-list">
            <div className="profile-summary-row">
              <dt>Name</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Role</dt>
              <dd>{formatRole(user.role)}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Workforce group</dt>
              <dd>{user.workforceGroupName?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Timezone</dt>
              <dd>{user.timezone?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>Preferred language</dt>
              <dd>
                {isSupportedLocale(user.preferredLanguage)
                  ? t(`layout:language.${user.preferredLanguage}`)
                  : t('common:profile.languageNotSet')}
              </dd>
            </div>
          </dl>
        </section>

        <section className="settings-card profile-image-card" aria-label="Profile photo">
          <div className="card-section-header">
            <h2 className="card-title">Profile Photo</h2>
          </div>
          <div className="profile-image-body">
            <ProfileAvatar
              fullName={user.fullName}
              profileImageUrl={user.profileImageUrl}
              size="lg"
            />
            <div className="profile-image-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                data-testid="profile-image-input"
                onChange={(event) => void handleFileChange(event)}
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={isUploading || isRemoving}
                data-busy={isUploading ? 'true' : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                {user.profileImageUrl ? 'Replace Photo' : 'Upload Photo'}
              </button>
              {user.profileImageUrl ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  data-testid="profile-image-remove-btn"
                  disabled={isUploading || isRemoving}
                  onClick={() => setRemoveOpen(true)}
                >
                  Remove Photo
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {removeOpen ? (
        <Modal
          labelledBy="profile-remove-title"
          onClose={() => setRemoveOpen(false)}
          closeOnBackdrop={false}
          testId="profile-remove-modal"
        >
          <div className="modal-header">
            <h2 className="modal-title" id="profile-remove-title">
              Remove Profile Photo
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setRemoveOpen(false)}
              aria-label="Close"
              disabled={isRemoving}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p className="body-text">Your profile photo will be removed from your account.</p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setRemoveOpen(false)}
              disabled={isRemoving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="profile-image-remove-confirm-btn"
              disabled={isRemoving}
              data-busy={isRemoving ? 'true' : undefined}
              onClick={() => void handleConfirmRemove()}
            >
              Remove Photo
            </button>
          </div>
        </Modal>
      ) : null}

    </div>
  )
}
