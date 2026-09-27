import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { authRequest } from './identity-api'
import type { Identity } from './session'

export default function AccountProfile({ account }: { account: Identity }) {
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true); setMessage(''); setError('')
    try {
      const response = await authRequest('profile', {
        full_name: String(values.get('full_name') || '').trim(),
        phone: String(values.get('phone') || '').trim(),
        job_title: String(values.get('job_title') || '').trim(),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { detail?: string }
        throw new Error(result.detail || 'Unable to save your profile.')
      }
      const result = await response.json() as Pick<Identity, 'full_name' | 'phone' | 'job_title'>
      cache.setQueryData<Identity | null>(['identity'], current => current ? { ...current, ...result } : current)
      setMessage('Profile updated.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save your profile.') }
    finally { setBusy(false) }
  }

  return <section className="account-profile-page" aria-labelledby="profile-title">
    <div className="account-page-heading"><h2 id="profile-title">Profile</h2><p>Your personal details for this account.</p></div>
    <div className="panel account-profile-card">
      <div className="account-profile-intro"><span className="account-profile-avatar">{(account.full_name || account.email).slice(0, 2).toUpperCase()}</span><div><h2>{account.full_name || 'Your profile'}</h2><p>{account.email}</p></div></div>
      <form onSubmit={save} className="account-profile-form">
        <label>Full name<input name="full_name" defaultValue={account.full_name} required maxLength={160} autoComplete="name" /></label>
        <label>Email address<input type="email" value={account.email} readOnly aria-describedby="profile-email-hint" /><small id="profile-email-hint">Your sign-in address is managed separately from profile details.</small></label>
        <label>Phone number<input name="phone" type="tel" defaultValue={account.phone} maxLength={40} autoComplete="tel" placeholder="Optional" /></label>
        <label>Role or job title<input name="job_title" defaultValue={account.job_title} maxLength={100} autoComplete="organization-title" placeholder="Optional" /></label>
        {error && <p role="alert" className="account-profile-error">{error}</p>}
        {message && <p role="status" className="account-profile-success"><CheckCircle2 size={16} />{message}</p>}
        <div className="account-profile-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  </section>
}
