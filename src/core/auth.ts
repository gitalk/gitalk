import { GT_ACCESS_TOKEN } from '../const'
import { queryStringify } from '../utils'

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'

export const getStoredToken = (): string | null => window.localStorage.getItem(GT_ACCESS_TOKEN)

export const storeToken = (token: string): void =>
  window.localStorage.setItem(GT_ACCESS_TOKEN, token)

export const clearToken = (): void => window.localStorage.removeItem(GT_ACCESS_TOKEN)

export const getLoginUrl = (clientID: string, redirectUri = window.location.href): string =>
  `${GITHUB_OAUTH_URL}?${queryStringify({
    client_id: clientID,
    redirect_uri: redirectUri,
    scope: 'public_repo',
  })}`

/** OAuth 授权码换 access_token。client secret 仅在这一步经 proxy 使用 */
export async function exchangeCodeForToken(opts: {
  proxy: string
  code: string
  clientID: string
  clientSecret: string
}): Promise<string> {
  const res = await fetch(opts.proxy, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: opts.code,
      client_id: opts.clientID,
      client_secret: opts.clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`OAuth token request failed with status ${res.status}`)

  const data = await res.json().catch(() => null)
  if (!data || !data.access_token) throw new Error('no access token')
  return data.access_token
}
