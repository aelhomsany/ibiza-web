import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, postAcceptInvitation } from '../../api/client'
import i18n from '../../i18n/config'
import { applyDocumentLanguage } from '../../i18n/documentLanguage'
import { AcceptInvitationPage } from './AcceptInvitationPage'

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  postAcceptInvitation: vi.fn(),
}))

function LoginDestination() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="login-destination">
        {String((location.state as { invitationAccepted?: boolean } | null)?.invitationAccepted)}
      </div>
      <button type="button" data-testid="login-back" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  )
}

function LocationSearchProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>
}

function TokenNavigationControl() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      data-testid="navigate-second-token"
      onClick={() => navigate('/accept-invitation?token=second-token')}
    >
      Open second invitation
    </button>
  )
}

function renderPage(path = '/accept-invitation?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationSearchProbe />
      <TokenNavigationControl />
      <Routes>
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillStrongMatchingPasswords() {
  const user = userEvent.setup()
  await user.type(screen.getByTestId('accept-invitation-password'), 'StrongPass1!')
  await user.type(screen.getByTestId('accept-invitation-password-confirm'), 'StrongPass1!')
  return user
}

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.mocked(postAcceptInvitation).mockReset()
    vi.mocked(postAcceptInvitation).mockResolvedValue({} as never)
  })

  afterEach(async () => {
    if (i18n.language !== 'en') {
      await act(async () => {
        await i18n.changeLanguage('en')
        applyDocumentLanguage('en')
      })
    }
  })

  it('renders the shared password-creation form for a usable token', () => {
    renderPage()

    expect(screen.getByTestId('accept-invitation-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accept your invitation' })).toBeInTheDocument()
    expect(screen.getByTestId('password-requirements')).toBeInTheDocument()
    expect(screen.getByTestId('accept-invitation-password')).toHaveAttribute('maxlength', '128')
    expect(screen.getByTestId('accept-invitation-password-confirm')).toHaveAttribute('maxlength', '128')
    expect(screen.getByTestId('accept-invitation-submit')).toBeDisabled()
  })

  it('uses one shared auth layout landmark with the form card before the proof panel', () => {
    renderPage()

    const mainLandmarks = screen.getAllByRole('main')
    expect(mainLandmarks).toHaveLength(1)
    expect(mainLandmarks[0]).toHaveClass('auth-layout')

    const heading = screen.getByRole('heading', { name: 'Accept your invitation' })
    const card = heading.closest('section')
    const form = screen.getByTestId('accept-invitation-submit').closest('form')
    const proof = screen.getByTestId('auth-proof-panel')

    expect(card).toHaveClass('auth-card')
    expect(mainLandmarks[0]).toContainElement(card)
    expect(mainLandmarks[0]).toContainElement(proof)
    expect(card?.parentElement).toBe(mainLandmarks[0])
    expect(proof.parentElement).toBe(mainLandmarks[0])
    expect(form).not.toBeNull()
    expect(form!.compareDocumentPosition(proof) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('removes the token from the visible URL after retaining it in component memory', async () => {
    renderPage('/accept-invitation?token=memory-only-token&source=email')

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?source=email')
    })

    const user = await fillStrongMatchingPasswords()
    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(postAcceptInvitation).toHaveBeenCalledWith({
      token: 'memory-only-token',
      password: 'StrongPass1!',
    })
  })

  it('uses a newly navigated invitation token instead of retaining a stale token', async () => {
    renderPage('/accept-invitation?token=first-token')
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement())
    await user.click(screen.getByTestId('navigate-second-token'))
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement())
    await user.type(screen.getByTestId('accept-invitation-password'), 'StrongPass1!')
    await user.type(screen.getByTestId('accept-invitation-password-confirm'), 'StrongPass1!')
    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(postAcceptInvitation).toHaveBeenCalledWith({
      token: 'second-token',
      password: 'StrongPass1!',
    })
  })

  it('blocks a missing token, disables the form, and makes no API request', async () => {
    const user = userEvent.setup()
    renderPage('/accept-invitation')

    expect(screen.getByRole('alert')).toHaveTextContent('This invitation link cannot be used')
    expect(screen.getByTestId('accept-invitation-password')).toBeDisabled()
    expect(screen.getByTestId('accept-invitation-password-confirm')).toBeDisabled()
    expect(screen.getByTestId('accept-invitation-submit')).toBeDisabled()
    await user.click(screen.getByTestId('accept-invitation-submit'))
    expect(postAcceptInvitation).not.toHaveBeenCalled()
  })

  it('keeps weak and mismatched passwords client-side', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByTestId('accept-invitation-password'), 'weak')
    await user.type(screen.getByTestId('accept-invitation-password-confirm'), 'different')

    expect(screen.getByTestId('password-requirement-minLength')).toHaveAttribute('data-met', 'false')
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(screen.getByTestId('accept-invitation-submit')).toBeDisabled()
    expect(postAcceptInvitation).not.toHaveBeenCalled()
  })

  it('submits once and replace-navigates to login with acceptance state', async () => {
    renderPage()
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(await screen.findByTestId('login-destination')).toHaveTextContent('true')
    expect(postAcceptInvitation).toHaveBeenCalledTimes(1)
    expect(postAcceptInvitation).toHaveBeenCalledWith({
      token: 'valid-token',
      password: 'StrongPass1!',
    })

    await user.click(screen.getByTestId('login-back'))
    expect(screen.getByTestId('login-destination')).toHaveTextContent('true')
  })

  it('does not navigate after the user leaves while acceptance is pending', async () => {
    let resolveAcceptance: (() => void) | undefined
    vi.mocked(postAcceptInvitation).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAcceptance = () => resolve({} as never)
        }),
    )
    renderPage()
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))
    await user.click(screen.getByRole('link', { name: 'Back to sign in' }))
    expect(screen.getByTestId('login-destination')).toHaveTextContent('undefined')

    await act(async () => {
      resolveAcceptance?.()
    })

    expect(screen.getByTestId('login-destination')).toHaveTextContent('undefined')
  })

  it('disables duplicate submission while acceptance is pending', async () => {
    vi.mocked(postAcceptInvitation).mockImplementation(() => new Promise(() => undefined))
    renderPage()
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(postAcceptInvitation).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('accept-invitation-submit')).toBeDisabled()
    await user.click(screen.getByTestId('accept-invitation-submit'))
    expect(postAcceptInvitation).toHaveBeenCalledTimes(1)
  })

  it('maps invitation conflicts to one neutral terminal message and clears credentials', async () => {
    vi.mocked(postAcceptInvitation).mockRejectedValueOnce(
      new ApiError(409, {
        status: 409,
        detail: 'This invitation expired yesterday',
      }),
    )
    renderPage('/accept-invitation?token=expired-token')
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation link cannot be used')
    expect(screen.getByRole('alert')).not.toHaveTextContent('expired yesterday')
    expect(screen.getByTestId('accept-invitation-password')).toHaveValue('')
    expect(screen.getByTestId('accept-invitation-password')).toBeDisabled()
    expect(screen.getByTestId('accept-invitation-submit')).toBeDisabled()
  })

  it('keeps a capacity-blocked invitation retryable without exposing server detail', async () => {
    vi.mocked(postAcceptInvitation).mockRejectedValueOnce(
      new ApiError(409, {
        status: 409,
        code: 'plan-limit-reached',
        detail: 'Secret organization name is at its limit',
      }),
    )
    renderPage()
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))

    expect(await screen.findByRole('alert')).toHaveTextContent('no available seat')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Secret organization')
    expect(screen.getByTestId('accept-invitation-password')).toHaveValue('StrongPass1!')
    expect(screen.getByTestId('accept-invitation-submit')).toBeEnabled()
  })

  it('shows a safe generic error after an unexpected failure and allows retry', async () => {
    vi.mocked(postAcceptInvitation).mockRejectedValueOnce(
      new ApiError(409, {
        status: 409,
        code: 'unrecognized-conflict',
        detail: 'internal capacity state leaked',
      }),
    )
    renderPage()
    const user = await fillStrongMatchingPasswords()

    await user.click(screen.getByTestId('accept-invitation-submit'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('try again'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal capacity state leaked')
    expect(screen.getByTestId('accept-invitation-submit')).toBeEnabled()
  })

  it('renders the invitation state in Arabic with RTL document direction', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
      applyDocumentLanguage('ar')
    })

    renderPage('/accept-invitation')

    expect(screen.getByRole('heading', { name: 'قبول دعوتك' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'اعرف بدقة تكلفة كل يوم' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('لا يمكن استخدام رابط الدعوة هذا')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })
})
