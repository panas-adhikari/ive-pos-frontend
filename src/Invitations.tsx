import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MailPlus, RotateCw, X } from 'lucide-react'
import { authRequest } from './identity-api'
import { platformRequest } from './platform-api'
import { setupRequest } from './organization-api'
import { useOptionalPlatformStepUp } from './PlatformStepUp'

type Invite = { id: string; email: string; status: string; expires: string }

export function InvitationList({ organizationId, platform = false }: { organizationId: string; platform?: boolean }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const runCritical = useOptionalPlatformStepUp()
  const path = platform ? `organizations/${organizationId}/invitations` : `${organizationId}/invitations`
  const request = platform ? platformRequest : setupRequest
  const query = useQuery<Invite[]>({ queryKey: ['invitations', platform, organizationId], queryFn: () => request(path), retry: false })
  async function change(id: string, action: string) {
    setBusy(true); setError('')
    try {
      const update = async () => {
        try { await request(`${path}/${id}`, 'POST', { action }); await query.refetch() }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update invitation.') }
      }
      if (runCritical) await runCritical(update); else await update()
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update invitation.') }
    finally { setBusy(false) }
  }
  async function inviteOwner() {
    setBusy(true); setError('')
    try {
      const send = async () => {
        try { await request(path, 'POST', {}); await query.refetch() }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to invite owner.') }
      }
      if (runCritical) await runCritical(send); else await send()
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to invite owner.') }
    finally { setBusy(false) }
  }
  if (!platform) return <section className="panel staff-invitations"><h3>Staff invitations</h3><p className="muted">Staff appear in the directory after accepting their invitation.</p>
    {query.isPending && <p role="status">Loading invitations…</p>}
    {(error || query.isError) && <p role="alert">{error || query.error?.message}</p>}
    {query.data?.length === 0 && <p className="muted">No invitations yet.</p>}
    <div className="staff-invitation-list">{query.data?.map(invite => <article className="staff-invitation-row" key={invite.id}><div><strong>{invite.email}</strong><p>{invite.status.charAt(0).toUpperCase() + invite.status.slice(1)} · Expires {new Date(invite.expires).toLocaleString()}</p></div>
      {['pending', 'expired'].includes(invite.status) && <div className="staff-invitation-actions"><button className="secondary-button" disabled={busy} onClick={() => void change(invite.id, 'resend')}><RotateCw aria-hidden="true" />Resend</button><button className="secondary-button" disabled={busy} onClick={() => void change(invite.id, 'revoke')}><X aria-hidden="true" />Revoke</button></div>}</article>)}</div>
  </section>
  return <section className="panel"><h3>Owner invitation</h3>
    {query.isPending && <p role="status">Loading invitations…</p>}
    {(error || query.isError) && <p role="alert">{error || query.error?.message}</p>}
    {query.data?.length === 0 && <p>No invitations yet.</p>}
    {platform && query.data && (query.data.length === 0 || query.data.every(i => i.status === 'revoked')) && <button className="icon-button" disabled={busy} onClick={() => void inviteOwner()}><MailPlus aria-hidden="true" />Send owner invitation</button>}
    {query.data?.map(invite => <article key={invite.id}><p><strong>{invite.email}</strong> · {invite.status}</p>
      {['pending', 'expired'].includes(invite.status) && <><p className="muted">Expires {new Date(invite.expires).toLocaleString()}</p><div className="action-row">
        <button className="icon-button" disabled={busy} onClick={() => void change(invite.id, 'resend')}><RotateCw aria-hidden="true" />Resend invitation</button>
        <button className="icon-button" disabled={busy} onClick={() => void change(invite.id, 'revoke')}><X aria-hidden="true" />Revoke invitation</button>
      </div></>}
    </article>)}
  </section>
}

async function invitationRequest(path: string, body: object) {
  const response = await authRequest(`invitations/${path}`, body)
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.detail || 'Unable to complete invitation.')
  }
  return response.status === 204 ? null : response.json()
}

export function AcceptInvitation({ token, done }: { token: string; done: (message: string) => void }) {
  const query = useQuery<{ organization: string; email: string; existing_account: boolean; roles: string[] }>({
    queryKey: ['invitation-preview', token], queryFn: () => invitationRequest('inspect', { token }), retry: false,
  })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    if (!query.data?.existing_account && form.get('password') !== form.get('confirm')) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      await invitationRequest('accept', { token, password: form.get('password'), code: form.get('code') || '' })
      done('Invitation accepted. Sign in with the invited email address to open your organization. Administrators can then enable MFA in Account security and complete business, store, and staff setup.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to accept invitation.') }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="panel auth-card"><img className="brand-logo" src="/ive-pos-logo.svg" alt="Ive POS" /><h1>Join your organization</h1>
    {query.isPending && <p role="status">Checking invitation…</p>}
    {query.isError && <p role="alert">{query.error.message}. Ask your administrator for a new invitation.</p>}
    {query.data && <><p>Join <strong>{query.data.organization}</strong> as {query.data.roles.join(', ')} using {query.data.email}.</p>
      <p>{query.data.existing_account ? 'Confirm your existing account password and MFA code, if enabled.' : 'Choose a password to create your verified account.'}</p>
      <form onSubmit={submit}><fieldset disabled={busy}>
        <label>{query.data.existing_account ? 'Account password' : 'New password'}<input name="password" type="password" autoComplete={query.data.existing_account ? 'current-password' : 'new-password'} required minLength={query.data.existing_account ? 1 : 15} maxLength={128} /></label>
        {query.data.existing_account ? <label>Authenticator or backup code<input name="code" autoComplete="one-time-code" maxLength={64} /></label>
          : <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" required minLength={15} maxLength={128} /></label>}
        <button className="primary-button">{busy ? 'Joining…' : 'Accept invitation'}</button>
      </fieldset></form></>}
    {error && <p role="alert">{error}</p>}<button className="secondary-button icon-button" onClick={() => done('Sign in to your account.')}><ArrowLeft aria-hidden="true" />Back to sign in</button>
  </section></main>
}
