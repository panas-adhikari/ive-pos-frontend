import { queryClient } from './api-cache'
import { identity } from './session'
import { apiUrl } from './api-url'

type RequestBody = object | undefined

function requestOptions(method: string, body: RequestBody): RequestInit {
  const writes = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
  const payload = writes ? JSON.stringify(body ?? {}) : undefined
  return {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: payload ? { 'Content-Type': 'application/json', 'X-POS-CSRF': '1' } : {},
    body: payload,
  }
}

export async function authenticatedRequest(url: string, method = 'GET', body?: object) {
  const options = requestOptions(method, body)
  let response = await fetch(apiUrl(url), options)
  if (response.status !== 401) return response

  // The access cookie may have expired while cached API data was still fresh. Refresh the
  // shared identity once, then retry the original request with the rotated cookies.
  const account = await queryClient.fetchQuery({
    queryKey: ['identity'], queryFn: identity, staleTime: 0,
  })
  if (!account) {
    queryClient.removeQueries({ predicate: query => query.queryKey[0] !== 'identity' })
    queryClient.setQueryData(['identity'], null)
    return response
  }
  response = await fetch(apiUrl(url), requestOptions(method, body))
  return response
}
