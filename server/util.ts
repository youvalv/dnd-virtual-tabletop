import { randomBytes, randomInt, createHash, createHmac, timingSafeEqual } from 'node:crypto'

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

export function shortId(len = 10): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

export function secretToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function rollDie(sides: number): number {
  return randomInt(1, sides + 1)
}

export function clampInt(v: unknown, min: number, max: number, fallback = min): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function cleanText(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string') return fallback
  // Strip control characters, keep newlines and tabs.
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max)
}

export function cleanColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback
}

export function cleanIcon(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^[a-z0-9-]{1,24}$/.test(v) ? v : fallback
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
