import { createContext, useContext, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { authRequest } from './identity-api'
import { identity } from './session'
import './step-up.css'

type Pending = { run: () => Promise<void>; resolve: (verified: boolean) => void; reject: (reason: unknown) => void }
type StepUpContextValue = { runCritical: (run: () => Promise<void>) => Promise<boolean> }
const StepUpContext = createContext<StepUpContextValue | null>(null)

function CriticalStepUpProvider({ children, scope }: { children: ReactNode; scope: 'platform' | 'organization' }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [error, setError] = useState('')

  async function runCritical(run: () => Promise<void>) {
    const account = await identity()
    if (!account) throw new Error('Your session expired. Sign in again.')
    if (!account.email_verified || !account.mfa_enabled) {
      throw new Error(`Verify your email and enable MFA in Profile & Security before changing ${scope} data.`)
    }
    if (account.step_up_expires && new Date(account.step_up_expires).getTime() > Date.now()) {
      await run()
      return true
    }
    setError('')
    setRepeat(account.require_action_verification)
    return new Promise<boolean>((resolve, reject) => setPending({ run, resolve, reject }))
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) return
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setError('')
    try {
      const account = await identity()
      if (!account) throw new Error('Your session expired. Sign in again.')
      const response = await authRequest('step-up', { password: values.get('password'), code: values.get('code') })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: string }
        throw new Error(body.detail || 'Unable to verify your identity.')
      }
      form.reset()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.')
      setBusy(false)
      return
    } finally { setBusy(false) }
    const task = pending
    if (!task) return
    setPending(null)
    try { await task.run(); task.resolve(true) }
    catch (reason) { task.reject(reason) }
  }

  function cancel() {
    pending?.resolve(false)
    setPending(null)
    setError('')
  }

  return <StepUpContext.Provider value={{ runCritical }}>
    {children}
    {pending && <div className="step-up-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) cancel() }}>
      <section className="step-up-popover" role="dialog" aria-modal="true" aria-labelledby="step-up-title">
        <h2 id="step-up-title">Verify to continue</h2>
        <p>Enter your password and a fresh authenticator or backup code. {repeat ? 'Verification lasts five minutes.' : 'Verification lasts until this session expires or you sign out.'}</p>
        <form onSubmit={verify}>
          <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required autoFocus /></label>
          <label>Authenticator or backup code<input name="code" autoComplete="one-time-code" maxLength={64} required spellCheck={false} autoCapitalize="none" /></label>
          {error && <p role="alert">{error}</p>}
          <div className="step-up-actions"><button className="primary-button" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button><button type="button" className="secondary-button" disabled={busy} onClick={cancel}>Cancel</button></div>
        </form>
      </section>
    </div>}
  </StepUpContext.Provider>
}

export function PlatformStepUpProvider({ children }: { children: ReactNode }) {
  return <CriticalStepUpProvider scope="platform">{children}</CriticalStepUpProvider>
}

export function OrganizationStepUpProvider({ children }: { children: ReactNode }) {
  return <CriticalStepUpProvider scope="organization">{children}</CriticalStepUpProvider>
}

export function usePlatformStepUp() {
  const context = useContext(StepUpContext)
  if (!context) throw new Error('Critical actions must be inside a step-up provider')
  return context.runCritical
}

export const useOrganizationStepUp = usePlatformStepUp

export function useOptionalPlatformStepUp() {
  return useContext(StepUpContext)?.runCritical
}
