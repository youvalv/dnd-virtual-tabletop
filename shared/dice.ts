// Dice notation parser and roller, shared by server (authoritative rolls) and client (validation).
// Supports: 1d20+5, 2d6, d8+3, 4d6kh3, 2d20kl1, d%, 3d6-1+1d4, plus "adv"/"dis" suffixes for a single d20.
import type { RollResult, RollTerm } from './types.ts'

export interface ParsedTerm {
  kind: 'dice' | 'mod'
  sign: 1 | -1
  count: number
  sides: number
  keep?: { mode: 'h' | 'l'; n: number }
  value: number
}

const TERM_RE = /^(\d*)d(\d+|%)(?:(k[hl]?|d[hl]?)(\d+))?$/

export function parseDice(input: string): ParsedTerm[] | null {
  let src = input.toLowerCase().replace(/\s+/g, '')
  if (!src) return null
  let adv: 'adv' | 'dis' | null = null
  const advMatch = src.match(/(adv|advantage|dis|disadvantage)$/)
  if (advMatch) {
    adv = advMatch[1].startsWith('adv') ? 'adv' : 'dis'
    src = src.slice(0, -advMatch[1].length)
  }
  if (!src) src = '1d20'
  if (!/^[+-]?[\dd%khl+-]+$/.test(src)) return null
  const parts = src.match(/[+-]?[^+-]+/g)
  if (!parts || parts.length > 12) return null
  const terms: ParsedTerm[] = []
  let diceTotal = 0
  for (const raw of parts) {
    const sign: 1 | -1 = raw.startsWith('-') ? -1 : 1
    const body = raw.replace(/^[+-]/, '')
    if (/^\d+$/.test(body)) {
      const value = Number(body)
      if (value > 10000) return null
      terms.push({ kind: 'mod', sign, count: 0, sides: 0, value })
      continue
    }
    const m = body.match(TERM_RE)
    if (!m) return null
    const count = m[1] === '' ? 1 : Number(m[1])
    const sides = m[2] === '%' ? 100 : Number(m[2])
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null
    diceTotal += count
    let keep: ParsedTerm['keep']
    if (m[3]) {
      const n = Number(m[4])
      const op = m[3]
      if (n < 1 || n > count) return null
      if (op === 'k' || op === 'kh') keep = { mode: 'h', n }
      else if (op === 'kl') keep = { mode: 'l', n }
      else if (op === 'd' || op === 'dl') keep = { mode: 'h', n: count - n }
      else if (op === 'dh') keep = { mode: 'l', n: count - n }
      if (keep && keep.n < 1) return null
    }
    terms.push({ kind: 'dice', sign, count, sides, keep, value: 0 })
  }
  if (diceTotal > 200) return null
  if (adv) {
    const d20 = terms.find((t) => t.kind === 'dice' && t.sides === 20 && t.count === 1 && !t.keep)
    if (!d20) return null
    d20.count = 2
    d20.keep = { mode: adv === 'adv' ? 'h' : 'l', n: 1 }
  }
  return terms
}

export function formatTerms(terms: ParsedTerm[]): string {
  return terms
    .map((t, i) => {
      const sign = t.sign < 0 ? '-' : i === 0 ? '' : '+'
      if (t.kind === 'mod') return `${sign}${t.value}`
      const keep = t.keep ? `k${t.keep.mode}${t.keep.n}` : ''
      return `${sign}${t.count}d${t.sides}${keep}`
    })
    .join('')
}

export function isValidDice(input: string): boolean {
  return parseDice(input) !== null
}

export function rollDice(input: string, rand: (sides: number) => number, label?: string): RollResult | null {
  const parsed = parseDice(input)
  if (!parsed) return null
  let total = 0
  let natural: RollResult['natural'] = null
  const terms: RollTerm[] = parsed.map((t) => {
    if (t.kind === 'mod') {
      total += t.sign * t.value
      return { kind: 'mod', sign: t.sign, value: t.value }
    }
    const values = Array.from({ length: t.count }, () => rand(t.sides))
    const kept = new Array(values.length).fill(true)
    if (t.keep) {
      const order = values.map((v, i) => ({ v, i })).sort((a, b) => (t.keep!.mode === 'h' ? b.v - a.v : a.v - b.v))
      kept.fill(false)
      order.slice(0, t.keep.n).forEach((o) => (kept[o.i] = true))
    }
    const sum = values.reduce((s, v, i) => (kept[i] ? s + v : s), 0)
    total += t.sign * sum
    return {
      kind: 'dice',
      sign: t.sign,
      count: t.count,
      sides: t.sides,
      keep: t.keep ? `k${t.keep.mode}${t.keep.n}` : undefined,
      rolls: values.map((value, i) => ({ value, kept: kept[i] })),
      value: sum,
    }
  })
  // Natural 20 / natural 1 when the roll has exactly one kept d20.
  const d20s = terms.filter((t) => t.kind === 'dice' && t.sides === 20)
  if (d20s.length === 1) {
    const keptRolls = d20s[0].rolls!.filter((r) => r.kept)
    if (keptRolls.length === 1) {
      if (keptRolls[0].value === 20) natural = 'crit'
      else if (keptRolls[0].value === 1) natural = 'fumble'
    }
  }
  return { expr: formatTerms(parsed), total, terms, natural, label: label?.slice(0, 60) || undefined }
}
