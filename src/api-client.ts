import { queryClient } from './api-cache'
import { identity } from './session'

type RequestBody = object | undefined

function requestOptions(method: string, body: RequestBody): RequestInit {
  const payload = body === undefined ? undefined : JSON.stringify(body)
  return {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: payload ? { 'Content-Type': 'application/json', 'X-POS-CSRF': '1' } : {},
    body: payload,
  }
}

export async function authenticatedRequest(url: string, method = 'GET', body?: object) {
  const options = requestOptions(method, body)
  let response = await fetch(url, options)
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
  response = await fetch(url, requestOptions(method, body))
  return response
}
