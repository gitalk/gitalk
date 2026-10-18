import { readFileSync } from 'node:fs'

/** One required variable, and what to tell someone who has not set it. */
export interface RequiredVar {
  readonly key: string
  readonly hint: string
}

/** Variables every deployment needs, whatever the platform. */
export const COMMON: RequiredVar[] = [
  { key: 'GITHUB_APP_ID', hint: 'the App ID from the GitHub App settings page' },
  { key: 'GITHUB_CLIENT_ID', hint: "the App's Client ID (Iv1.… or Iv23li…)" },
  { key: 'GITHUB_CLIENT_SECRET', hint: 'a generated client secret' },
  { key: 'GITHUB_APP_PRIVATE_KEY', hint: 'the .pem contents, not the fingerprint' },
  { key: 'SESSION_ENCRYPTION_KEY', hint: 'run `openssl rand -hex 32`' },
  { key: 'GITALK_ALLOWED_ORIGINS', hint: 'comma-separated origins, e.g. https://blog.example' }
]

/** Parse a dotenv file. Quoted values keep their newlines, which PEM keys need. */
export function parseEnvFile(path: string): Record<string, string> {
  const raw = readFileSync(path, 'utf8')
  const out: Record<string, string> = {}
  // PEM keys legitimately span lines, so a quoted value runs to its closing quote.
    // [ \t] rather than \s around the value: \s matches newlines, so a key left
    // empty would swallow the following line as if it were that key\'s value.
    const re = /^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*(?:"([\s\S]*?)"|\'([\s\S]*?)\'|([^\r\n]*))[ \t]*$/gm
  for (const m of raw.matchAll(re)) {
    out[m[1]] = (m[2] ?? m[3] ?? m[4] ?? '').replace(/\\n/g, '\n').trim()
  }
  return out
}

/** Every missing variable, with its hint, or an empty list. */
export function missing(env: Record<string, string>, required: readonly RequiredVar[]): RequiredVar[] {
  return required.filter((v) => !env[v.key]?.trim())
}
