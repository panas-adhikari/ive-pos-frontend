import { authenticatedRequest } from './api-client'

export async function setupRequest(path: string, method = 'GET', body?: object) {
  const response = await authenticatedRequest(`/api/v1/organizations/${path}`, method, body)
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { detail?: string }
    if (response.status === 401) throw new Error('Your session expired. Sign in again.')
    throw new Error(error.detail || 'Unable to load or save setup. Please retry.')
  }
  return response.json()
}
