import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import { ApiError, removeProfileImage, uploadProfileImage } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { isSupportedLocale } from '../../i18n/documentLanguage'
import { ProfileAvatar } from './ProfileAvatar'
import './profile-page.css'

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'layout', 'common'])
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
      showToast(t('profile:success.updated'), 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? t('profile:errors.upload')
          : t('profile:errors.upload')
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
      showToast(t('profile:success.removed'), 'success')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.problem.detail ?? t('profile:errors.remove')
          : t('profile:errors.remove')
      showToast(message, 'warning')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="page page-wide" data-testid="profile-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('profile:title')}</h1>
          <p className="page-sub">{t('profile:subtitle')}</p>
        </div>
      </header>

      <div className="profile-layout">
        <section className="settings-card profile-summary-card" aria-label={t('profile:summary')}>
          <div className="card-section-header">
            <h2 className="card-title">{t('profile:account')}</h2>
          </div>
          <dl className="profile-summary-list">
            <div className="profile-summary-row">
              <dt>{t('profile:fields.name')}</dt>
              <dd dir="auto">{user.fullName}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.email')}</dt>
              <dd dir="auto">{user.email}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.role')}</dt>
              <dd>{t(`common:roles.${roleKey(user.role)}`)}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.workforceGroup')}</dt>
              <dd>{user.workforceGroupName?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.timezone')}</dt>
              <dd>{user.timezone?.trim() || t('common:profile.notApplicable')}</dd>
            </div>
            <div className="profile-summary-row">
              <dt>{t('profile:fields.preferredLanguage')}</dt>
              <dd>
                {isSupportedLocale(user.preferredLanguage)
                  ? t(`layout:language.${user.preferredLanguage}`)
                  : t('common:profile.languageNotSet')}
              </dd>
            </div>
          </dl>
        </section>

        <section className="settings-card profile-image-card" aria-label={t('profile:photo.summary')}>
          <div className="card-section-header">
            <h2 className="card-title">{t('profile:photo.title')}</h2>
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
                hidden
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
                {user.profileImageUrl ? t('profile:actions.replace') : t('profile:actions.upload')}
              </button>
              {user.profileImageUrl ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  data-testid="profile-image-remove-btn"
                  disabled={isUploading || isRemoving}
                  onClick={() => setRemoveOpen(true)}
                >
                  {t('profile:actions.remove')}
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
              {t('profile:photo.removeTitle')}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={() => setRemoveOpen(false)}
              aria-label={t('common:actions.close')}
              disabled={isRemoving}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p className="body-text">{t('profile:photo.removeCopy')}</p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setRemoveOpen(false)}
              disabled={isRemoving}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="profile-image-remove-confirm-btn"
              disabled={isRemoving}
              data-busy={isRemoving ? 'true' : undefined}
              onClick={() => void handleConfirmRemove()}
            >
              {t('profile:actions.remove')}
            </button>
          </div>
        </Modal>
      ) : null}

    </div>
  )
}

function roleKey(role: string): string {
  if (role === 'HR_ADMIN') return 'hrAdmin'
  if (role === 'PLATFORM_ADMIN') return 'platformAdmin'
  return role.toLowerCase()
}
