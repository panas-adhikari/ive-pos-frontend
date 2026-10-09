import { authRequest as request } from './identity-api'

export type Identity = {
  id: string
  email: string
  full_name: string
  phone: string
  job_title: string
  platform_role: 'none' | 'super_admin' | 'employee'
  session_id: string
  email_verified: boolean
  must_change_password: boolean
  mfa_enabled: boolean
  require_action_verification: boolean
  step_up_expires: string | null
  memberships: {
    organization_id: string; name: string; image_url: string; organization_type: string; permissions: string[]; roles: string[];
    all_stores: boolean; store_ids: string[]
  }[]
}

let refreshInFlight: Promise<Response> | undefined

async function restoreSession() {
  async function restore() {
    // Recheck after taking the cross-tab lock: another tab may already have rotated.
    const current = await request('me')
    if (current.status !== 401) return current
    const refreshed = await request('refresh', {})
    if (refreshed.status === 401) return refreshed
    if (!refreshed.ok) throw new Error('Unable to restore your session. Please retry.')
    return request('me')
  }
  if (!refreshInFlight) {
    refreshInFlight = ('locks' in navigator
      ? navigator.locks.request('pos-session-refresh', restore)
      : restore()).finally(() => { refreshInFlight = undefined })
  }
  return refreshInFlight
}

export async function identity(): Promise<Identity | null> {
  let response = await request('me')
  if (response.status === 401) response = await restoreSession()
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Unable to reach your account. Please retry.')
  return response.json() as Promise<Identity>
}

export function hasVerifiedSession(account: Identity | null | undefined) {
  return !!(account?.mfa_enabled && account.step_up_expires && new Date(account.step_up_expires).getTime() > Date.now())
}
