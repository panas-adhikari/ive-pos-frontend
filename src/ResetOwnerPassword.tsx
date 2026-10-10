import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { OwnerCredentialsPopover } from './ControlPanels'
import type { OrganizationDetail, ProvisionedOwner } from './ControlPanels'
import { platformRequest } from './platform-api'
import { usePlatformStepUp } from './PlatformStepUp'

type ResetResult = { id: string; organization: string; email: string; login_url: string; temporary_password: string }

export default function ResetOwnerPassword({ org }: { org: OrganizationDetail }) {
  const verify = usePlatformStepUp()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [owner, setOwner] = useState<ProvisionedOwner | null>(null)
  const [completed, setCompleted] = useState(false)
  async function reset() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await verify(async () => {
        const result = await platformRequest(`organizations/${org.id}/owner-password-reset`, 'POST', { expected_version: org.version }) as ResetResult
        setOwner({ id: result.id, organization: result.organization, email: result.email, login_url: result.login_url, temporaryPassword: result.temporary_password })
        setConfirming(false); setCompleted(true)
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to reset the administrator password.') }
    finally { setBusy(false) }
  }
  return <section className="platform-password-reset" aria-labelledby="owner-password-title">
    <h3 id="owner-password-title">Administrator password</h3>
    <p className="muted">Create a temporary password for {org.contact_email || 'this organization’s administrator'}. The administrator must choose a new password after signing in.</p>
    {completed && !owner && <p role="status">Administrator password reset. Share the temporary sign-in details with the administrator.</p>}
    {!confirming ? <button type="button" className="secondary-button icon-button" disabled={!org.contact_email || !!org.deletion_scheduled_for} onClick={() => { setConfirming(true); setError('') }}><KeyRound size={15} aria-hidden="true" />Reset administrator password</button> : <div className="platform-password-confirm">
      <p>Reset the password for <strong>{org.contact_email}</strong>? This signs out all of their sessions. MFA remains enabled if configured.</p>
      <div className="platform-form-actions"><button type="button" className="primary-button" disabled={busy} onClick={() => void reset()}>{busy ? 'Resetting…' : 'Generate temporary password'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setConfirming(false); setError('') }}>Cancel</button></div>
    </div>}
    {error && <p role="alert" className="platform-form-error">{error}</p>}
    {owner && <OwnerCredentialsPopover owner={owner} reset done={() => setOwner(null)} />}
  </section>
}
