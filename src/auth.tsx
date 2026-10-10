import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import SignInPage from './public/SignInPage'
import { isWorkspacePath, navigate, usePathname } from './navigation'
import type { Site } from './public/site'
import { EmailFlow, FactorField, RecoveryCodes } from './identity'
import { authRequest as request, takeEmailLink } from './identity-api'
import { hasVerifiedSession, identity } from './session'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from './components/ui'
import type { FormEvent, ReactNode } from 'react'


type AccountActions = { password: () => void; signOut: () => void; busy: boolean; securityAvailable: boolean; emailEnabled: boolean; securityCodes: (codes: string[], signOut: boolean) => void; signedOut: () => void }
const AccountActionsContext = createContext<AccountActions | null>(null)
export function useAccountActions() { return useContext(AccountActionsContext) }

export function AuthBoundary({ children, site }: { children: ReactNode; site: Site }) {
  const cache = useQueryClient()
  const path = usePathname()
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false,
    networkMode: 'always' })
  const previousSession = useRef<string | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [link, setLink] = useState(takeEmailLink)
  const [mode, setMode] = useState<'signup' | 'reset' | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const capabilities = useQuery({ queryKey: ['auth-capabilities'], queryFn: async () => {
    const response = await request('capabilities')
    if (!response.ok) throw new Error('Service unavailable')
    return response.json() as Promise<{ email: boolean; mfa: boolean }>
  }, retry: false })
  const authTitle = backupCodes.length ? 'Recovery codes'
    : link || mode ? (link?.purpose === 'verify' ? 'Verify email' : (link?.purpose || mode) === 'reset' ? 'Reset password' : 'Create account')
    : account.isPending ? 'Checking session'
    : account.isError ? 'Unable to connect'
    : !account.data ? 'Sign in'
    : account.data.must_change_password ? 'Set your password'
    : showPassword ? 'Change password' : null
  useEffect(() => {
    if (authTitle) document.title = `${authTitle} — Ive POS`
  }, [authTitle])
  useEffect(() => {
    const receive = () => { const next = takeEmailLink(); if (next) setLink(next) }
    window.addEventListener('hashchange', receive)
    return () => window.removeEventListener('hashchange', receive)
  }, [])
  useEffect(() => {
    if (account.isPending || account.isError) return
    const currentSession = account.data?.session_id ?? null
    if (previousSession.current !== undefined && previousSession.current !== currentSession) {
      cache.removeQueries({ predicate: query => query.queryKey[0] !== 'identity' })
    }
    previousSession.current = currentSession
  }, [account.data?.session_id, account.isPending, account.isError, cache])
  useEffect(() => {
    if (!account.isPending && !account.isError && !account.data && !link && !mode && path !== '/login') {
      navigate(`/login${isWorkspacePath(path) && !['/', '/app'].includes(path) ? `?next=${encodeURIComponent(path)}` : ''}`, true)
    }
  }, [account.isPending, account.isError, account.data, link, mode, path])
  function clearSession() {
    cache.clear(); cache.setQueryData(['identity'], null)
    setShowPassword(false)
    navigate('/login', true)
  }


  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setError('')
    try {
      const response = await request('login', {
        email: data.get('email'), password: data.get('password'), code: data.get('code') || '',
      })
      if (!response.ok) {
        setError(response.status === 401 ? 'Invalid email or password, or missing/invalid authentication code.'
          : response.status === 429 ? 'Too many attempts. Please try again later.'
          : 'Sign-in is unavailable. Please check your connection and try again.')
        return
      }
      form.reset()
      cache.clear()
      await account.refetch()
    } catch {
      setError('Could not reach the service. Please try again.')
    } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const response = await request('logout', {})
      if (!response.ok) throw new Error()
      cache.clear()
      cache.setQueryData(['identity'], null)
      setShowPassword(false)
      navigate('/login', true)
    } catch { setError('Sign-out could not be confirmed. Please retry.') }
    finally { setBusy(false) }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (data.get('new_password') !== data.get('confirm_password')) {
      setError('New passwords do not match.')
      return
    }
    if (account.data?.must_change_password && data.get('current_password') && data.get('current_password') === data.get('new_password')) {
      setError('Choose a new password that is different from your temporary password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Refresh the short-lived access cookie before this explicit user action.
      if (!await identity()) { await account.refetch(); return }
      const response = await request('password', {
        current_password: data.get('current_password') || '', new_password: data.get('new_password'), code: data.get('code') || '',
      })
      if (!response.ok) {
        const passwordHint = account.data?.must_change_password
          ? 'Enter the temporary password you used to sign in, then choose a different new password.'
          : 'Enter your current sign-in password.'
        setError(response.status === 400 ? `${passwordHint}${account.data?.mfa_enabled ? ' Check the current code from your authenticator app or use an unused recovery code.' : ''}`
          : 'Password change failed. Please retry shortly.')
        return
      }
      form.reset()
      cache.clear()
      cache.setQueryData(['identity'], null)
      setShowPassword(false)
      navigate('/login', true)
      setError('Password changed. Sign in again with your new password.')
    } catch { setError('Could not confirm the password change. Please try signing in again.') }
    finally { setBusy(false) }
  }

  if (backupCodes.length) return <RecoveryCodes codes={backupCodes} done={() => { setBackupCodes([]); void account.refetch() }} />
  if (link || mode) return <EmailFlow key={link?.token || mode} mode={mode || 'signup'} link={link} done={message => {
    setLink(null); setMode(null); setError(message); void account.refetch()
  }} />
  if (account.isPending) return <main className="auth-page"><p role="status">Checking your session…</p></main>
  if (account.isError) return <main className="auth-page"><section className="panel auth-card">
    <h1>Unable to connect</h1><p>Your account could not be checked.</p>
    <button className="secondary-button" onClick={() => void account.refetch()}>Try again</button>
  </section></main>

  if (!account.data) return <SignInPage site={site} busy={busy} error={error}
    emailEnabled={!!capabilities.data?.email} submit={signIn}
    recover={() => setMode('reset')} signup={() => setMode('signup')} />

  const actions: AccountActions = { busy, securityAvailable: !!capabilities.data?.mfa, emailEnabled: !!capabilities.data?.email,
    password: () => { setError(''); setShowPassword(true) }, signOut: () => void signOut(),
    securityCodes: (value, signOut) => { setBackupCodes(value); if (signOut) clearSession() }, signedOut: clearSession }
  return <AccountActionsContext.Provider value={actions}>
    {showPassword || account.data.must_change_password ?
      <main className="account-page min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8 flex items-center justify-between gap-4"><a className="brand" href="#main"><img className="brand-logo" src="/ive-pos-logo.svg" alt="Ive POS" /></a>{account.data.must_change_password ? <Button variant="ghost" onClick={() => { if (window.confirm('Log out of Ive POS?')) void signOut() }}>Sign out</Button> : <Button variant="ghost" onClick={() => { setShowPassword(false); setError('') }}><ArrowLeft size={16} />Back to workspace</Button>}</div>
          <div className="mb-7"><p className="eyebrow">YOUR ACCOUNT</p><h1 id="password-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{account.data.must_change_password ? 'Set your password' : 'Change password'}</h1><p className="mt-2 text-sm text-slate-500">{account.data.must_change_password ? 'For your first sign-in, replace the temporary password supplied by your administrator with a different password of your own.' : 'Choose a strong password you don’t use anywhere else.'}</p></div>
          <Card className="max-w-2xl rounded-xl">
            <CardHeader className="border-b border-slate-100 px-6 py-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 text-emerald-800" size={19} /><div><CardTitle>Password</CardTitle><CardDescription className="mt-2">Use 15–128 characters. Changing your password signs out every session.</CardDescription></div></div></CardHeader>
            <CardContent className="p-6"><form className="grid max-w-lg gap-5" onSubmit={changePassword}>
              {!hasVerifiedSession(account.data) && <div className="grid gap-2"><Label htmlFor="current-password">{account.data.must_change_password ? 'Temporary password' : 'Current password'}</Label><Input id="current-password" name="current_password" type="password" autoComplete="current-password" required maxLength={128} aria-describedby={account.data.must_change_password ? 'temporary-password-help' : undefined} />{account.data.must_change_password && <p id="temporary-password-help" className="text-sm text-slate-500">Enter the same temporary password you just used to sign in.</p>}</div>}
              <div className="grid gap-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="new_password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} /></div>
              <div className="grid gap-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} /></div>
              {account.data.mfa_enabled && !hasVerifiedSession(account.data) && <FactorField required />}
              {error && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
              <div className="border-t border-slate-100 pt-5"><Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password and sign out'}</Button></div>
            </form></CardContent>
          </Card>
        </div>
      </main> : <>{error && <p role="alert" className="account-message">{error}</p>}{children}</>}
  </AccountActionsContext.Provider>
}
