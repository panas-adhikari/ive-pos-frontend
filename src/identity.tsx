import { useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, CheckCircle2, KeyRound, MailCheck, ShieldCheck } from 'lucide-react'

import { hasVerifiedSession } from './session'
import type { Identity } from './session'
import SecurityPreferences from './SecurityPreferences'
import { authRequest } from './identity-api'
import type { EmailLink } from './identity-api'
import { AcceptInvitation } from './Invitations'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from './components/ui'

async function failure(response: Response): Promise<string> {
  if (response.status === 429) return 'Too many attempts. Please try again later.'
  if (response.status === 503) return 'This service is unavailable. Please try again later.'
  if (response.status === 401) return 'Your session expired. Sign in again.'
  const body = await response.json().catch(() => null) as { detail?: string } | null
  return body?.detail || 'The request failed. Please try again.'
}

export function FactorField({ required = false }: { required?: boolean }) {
  return <Label className="grid gap-2">Authenticator or backup code<Input name="code" autoComplete="one-time-code" maxLength={64} required={required} spellCheck={false} autoCapitalize="none" /></Label>
}

export function EmailFlow(props: {
  mode: 'signup' | 'reset'; link: EmailLink | null; done: (message: string) => void
}) {
  if (props.link?.purpose === 'invite') return <AcceptInvitation token={props.link.token} done={props.done} />
  return <StandardEmailFlow {...props} />
}

function StandardEmailFlow({ mode, link, done }: {
  mode: 'signup' | 'reset'; link: EmailLink | null; done: (message: string) => void
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (link && link.purpose !== 'verify' && data.get('password') !== data.get('confirm')) {
      setMessage('Passwords do not match.'); return
    }
    setBusy(true); setMessage('')
    try {
      const path = link ? (link.purpose === 'verify' ? 'email/complete'
        : link.purpose === 'signup' ? 'signup/complete' : 'recovery/complete')
        : mode === 'signup' ? 'signup/request' : 'recovery/request'
      const body = link ? { token: link.token, ...(link.purpose !== 'verify' ? { password: data.get('password') } : {}),
        ...(link.purpose === 'signup' ? { organization: data.get('organization') } : {}),
        ...(link.purpose === 'reset' ? { code: data.get('code') || '' } : {}) }
        : { email: data.get('email') }
      const response = await authRequest(path, body)
      if (!response.ok) { setMessage(await failure(response)); return }
      if (link) done(link.purpose === 'signup' ? 'Account created. Sign in to continue.'
        : link.purpose === 'reset' ? 'Password reset. Sign in with your new password.' : 'Email verified. You can now set up MFA.')
      else setMessage('If this address is eligible, an email will arrive shortly. Check your inbox and spam folder.')
    } catch { setMessage('Could not confirm the request. Check your connection and try again.') }
    finally { setBusy(false) }
  }
  const purpose = link?.purpose || mode
  return <main className="auth-page"><section className="panel auth-card">
    <img className="brand-logo" src="/ive-pos-logo.svg" alt="Ive POS" />
    <h1>{purpose === 'signup' ? 'Create your account' : purpose === 'verify' ? 'Verify your email' : 'Reset your password'}</h1>
    <p className="muted">{link ? 'Complete the request below. Email links expire after 30 minutes.'
      : 'We’ll email you a link to continue.'}</p>
    <form onSubmit={submit}>
      {!link && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {link?.purpose === 'signup' && <label>Business name<input name="organization" maxLength={160} required /></label>}
      {link && link.purpose !== 'verify' && <>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></label>
        <label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></label>
        <p className="muted">Use 15–128 characters.</p>
      </>}
      {link?.purpose === 'reset' && <><FactorField /><p className="muted">Required if you enabled MFA. Resetting your password signs out all sessions and keeps MFA enabled.</p></>}
      {message && <p role="status" className="auth-message">{message}</p>}
      <button className="primary-link" disabled={busy}>{busy ? 'Please wait…' : link ? 'Complete request' : 'Email me a link'}</button>
    </form>
    <button className="secondary-button icon-button" disabled={busy} onClick={() => done('')}><ArrowLeft aria-hidden="true" />Back to sign in</button>
  </section></main>
}

export function RecoveryCodes({ codes, done }: { codes: string[]; done: () => void }) {
  return <main className="auth-page"><section className="panel auth-card">
    <h1>Save your backup codes</h1>
    <p>Keep these somewhere safe, separate from your phone. Each code works once. They will not be shown again.</p>
    <pre className="backup-codes">{codes.join('\n')}</pre>
    <button className="primary-link" onClick={done}>I saved my codes</button>
  </section></main>
}

export function SecurityPanel({ account, email, verified, mfa, emailEnabled, mfaAvailable, refresh, codes, signedOut, changePassword, onboarding = false }: {
  account: Identity; email: string;
  verified: boolean; mfa: boolean; emailEnabled: boolean; mfaAvailable: boolean; refresh: () => Promise<unknown>;
  codes: (value: string[], signOut: boolean) => void; signedOut: () => void; changePassword: () => void; onboarding?: boolean
}) {
  const [enrollment, setEnrollment] = useState<{ secret: string } | null>(null)
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, data = new FormData(form)
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'mfa/enroll'
    setBusy(true); setMessage('')
    try {
      await refresh()
      const response = await authRequest(action, action === 'mfa/confirm' ? { code: data.get('code') }
        : { password: data.get('password') || '', code: data.get('code') || '' })
      if (!response.ok) { setMessage(await failure(response)); return }
      form.reset()
      if (action === 'mfa/enroll') setEnrollment(await response.json() as { secret: string })
      else if (action === 'mfa/confirm' || action === 'mfa/recovery-codes') {
        const result = await response.json() as { recovery_codes: string[] }
        setEnrollment(null); codes(result.recovery_codes, false)
      } else if (action === 'mfa/disable') signedOut()
      else setMessage('Verification email requested. Check your inbox.')
    } catch { setMessage('Could not confirm the change. Please check your account before retrying.') }
    finally { setBusy(false) }
  }
  const issuer = 'Ive POS'
  const otpUri = enrollment
    ? `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${encodeURIComponent(enrollment.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    : ''
  return <section className="account-security-page" aria-labelledby="security-title">
    <div className="security-page-heading"><div><h2 id="security-title">Security</h2><p>Manage email verification and sign-in protection.</p></div>{!onboarding && <button className="secondary-button" onClick={changePassword}>Change password</button>}</div>
    <div className="security-page-content">
      {!onboarding && <SecurityPreferences account={account} />}
      <div className="security-status-strip">
        <div><MailCheck size={18} aria-hidden="true" /><span>Email</span><strong>{verified ? 'Verified' : 'Verification needed'}</strong></div>
        <div><ShieldCheck size={18} aria-hidden="true" /><span>MFA</span><strong>{mfa ? 'Enabled' : 'Not enabled'}</strong></div>
      </div>
      <Card className="rounded-xl">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3"><span className="mt-0.5 text-emerald-800"><KeyRound size={19} /></span><div><CardTitle>{enrollment ? 'Connect your authenticator' : 'Sign-in protection'}</CardTitle><CardDescription className="mt-2">{enrollment ? 'Scan the code with your authenticator app, then enter its current code.' : hasVerifiedSession(account) ? 'Your verified session authorizes security changes.' : 'Verify your identity before changing account security settings.'}</CardDescription></div></div>
        </CardHeader>
        <CardContent className="p-6">
          {!verified && !emailEnabled ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Email delivery must be configured before you can verify your email and enable two-factor authentication.</div> : verified && !mfa && !mfaAvailable ? <p className="text-sm text-amber-800">Authenticator setup is unavailable right now. Contact your administrator.</p> : <form className="grid max-w-xl gap-5" onSubmit={submit}>
            {enrollment ? <>
              <p className="text-sm leading-relaxed text-slate-600">Open an authenticator app and scan this QR code. It uses time-based six-digit codes.</p>
              <div className="mfa-qr mx-auto" aria-label="Authenticator setup QR code"><QRCodeSVG value={otpUri} size={190} includeMargin /></div>
              <details className="rounded-lg border border-slate-200 px-4 py-3 text-sm"><summary className="cursor-pointer font-medium text-slate-700">Can’t scan? Use the setup key</summary><code className="setup-key mt-3 rounded-md">{enrollment.secret}</code></details>
              <p className="text-sm leading-relaxed text-slate-500">Enter a code from the app within 10 minutes. Confirmation signs out all sessions.</p>
              <div className="grid gap-2"><Label htmlFor="security-code">Authenticator code</Label><Input id="security-code" name="code" autoComplete="one-time-code" maxLength={64} required /></div>
              <Button type="submit" value="mfa/confirm" disabled={busy}><CheckCircle2 size={16} />{busy ? 'Confirming…' : 'Confirm authenticator'}</Button>
            </> : <>
              {!hasVerifiedSession(account) && <div className="grid gap-2"><Label htmlFor="security-password">Current password</Label><Input id="security-password" name="password" type="password" autoComplete="current-password" maxLength={128} required /></div>}
              {mfa && !hasVerifiedSession(account) && <FactorField required />}
              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                {!verified && <Button type="submit" variant="outline" value="email/request" disabled={busy}><MailCheck size={16} />{busy ? 'Sending…' : 'Send verification email'}</Button>}
                {verified && !mfa && mfaAvailable && <Button type="submit" value="mfa/enroll" disabled={busy}><ShieldCheck size={16} />{busy ? 'Preparing…' : 'Set up authenticator'}</Button>}
                {mfa && <>
                  <Button type="submit" variant="outline" value="mfa/recovery-codes" disabled={busy}>Replace backup codes</Button>
                  <Button type="submit" variant="destructive" value="mfa/disable" disabled={busy}>Disable MFA and sign out</Button>
                </>}
              </div>
            </>}
          </form>}
          {message && <p role="alert" className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}
        </CardContent>
      </Card>
    </div>
  </section>
}
