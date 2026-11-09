// HTTP helpers and local credential storage. Players have no accounts: the
// server issues a random secret on join, which we keep in localStorage so a
// refresh or reconnect lands you back at the table as the same person.
export interface Credential {
  campaignId: string
  participantId: string
  token: string
  role: 'dm' | 'player'
  name: string // campaign name, for the "your tables" list
  savedAt: number
}

const KEY = 'hearthlight.tables.v1'

export function loadCredentials(): Credential[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function getCredential(campaignId: string): Credential | null {
  return loadCredentials().find((c) => c.campaignId === campaignId) ?? null
}

export function saveCredential(c: Omit<Credential, 'savedAt'>) {
  const list = loadCredentials().filter((x) => x.campaignId !== c.campaignId)
  list.unshift({ ...c, savedAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)))
}

export function renameCredential(campaignId: string, name: string) {
  const list = loadCredentials()
  const c = list.find((x) => x.campaignId === campaignId)
  if (c && c.name !== name) {
    c.name = name
    localStorage.setItem(KEY, JSON.stringify(list))
  }
}

export function forgetCredential(campaignId: string) {
  localStorage.setItem(KEY, JSON.stringify(loadCredentials().filter((x) => x.campaignId !== campaignId)))
}

export async function api<T>(path: string, opts: RequestInit & { json?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) }
  if (opts.json !== undefined) headers['content-type'] = 'application/json'
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  const res = await fetch(path, { ...opts, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as T
}

export function inviteUrl(code: string) {
  return `${location.origin}/join/${code}`
}
