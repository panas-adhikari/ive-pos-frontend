import './account-workflows.css'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authRequest } from './identity-api'
import { hasVerifiedSession, identity } from './session'
import type { Identity } from './session'

export default function SecurityPreferences({ account }: { account: Identity }) {
  const cache = useQueryClient()
  const [repeat, setRepeat] = useState(account.require_action_verification)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true); setMessage(''); setError('')
    try {
      if (!await identity()) throw new Error('Your session expired. Sign in again.')
      const response = await authRequest('security-preferences', {
        require_action_verification: repeat,
        password: data.get('password') || '', code: data.get('code') || '',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Unable to save security preferences.')
      }
      form.reset()
      await cache.invalidateQueries({ queryKey: ['identity'] })
      setMessage('Verification preference saved for all your sessions.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save preference.') }
    finally { setBusy(false) }
  }
  return <section className="panel verification-preferences" aria-labelledby="verification-title">
    <h3 id="verification-title">Verification for changes</h3>
    <p className="muted">By default, signing in with MFA verifies changes until your session expires or you sign out.</p>
    <form className="account-profile-form" onSubmit={save}>
      <label><span className="verification-choice"><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)} /> Ask for my password and MFA again for sensitive changes</span><small>When enabled, each verification lasts five minutes.</small></label>
      {!hasVerifiedSession(account) && <>
        <label>Current password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
        {account.mfa_enabled && <label>Authenticator or backup code<input name="code" autoComplete="one-time-code" required maxLength={64} /></label>}
      </>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div><button className="primary-button" disabled={busy || repeat === account.require_action_verification}>{busy ? 'Saving…' : 'Save verification preference'}</button></div>
    </form>
  </section>
}
