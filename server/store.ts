// Database access for campaigns, participants, chat and save points.
import { and, desc, eq, gt, sql, asc } from 'drizzle-orm'
import { db, campaigns, participants, messages, gameSessions, snapshots } from '../db/index.ts'
import type { Board, ChatMessage, RollResult } from '../shared/types.ts'
import { HttpError } from './util.ts'

export type CampaignRow = typeof campaigns.$inferSelect
export type ParticipantRow = typeof participants.$inferSelect
export type MessageRow = typeof messages.$inferSelect

export class NoChange extends Error {}

export async function loadCampaign(id: string): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
  return row ?? null
}

export async function loadCampaignByInvite(code: string): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.inviteCode, code)).limit(1)
  return row ?? null
}

export async function loadParticipants(campaignId: string): Promise<ParticipantRow[]> {
  return db.select().from(participants).where(eq(participants.campaignId, campaignId)).orderBy(asc(participants.createdAt))
}

export async function findParticipantByToken(campaignId: string, tokenHash: string): Promise<ParticipantRow | null> {
  const [p] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.campaignId, campaignId), eq(participants.tokenHash, tokenHash)))
    .limit(1)
  return p ?? null
}

// Serializes mutations per campaign within this instance (cheap, avoids lock contention).
const queues = new Map<string, Promise<unknown>>()
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  const next = prev.then(task, task)
  const settled = next.catch(() => {})
  queues.set(key, settled)
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key)
  })
  return next
}

class VersionConflict extends Error {}

/**
 * Applies `fn` to the campaign's board inside a transaction holding a row lock,
 * so concurrent edits from any server instance are serialized. The write is also
 * guarded by the version that was read (optimistic check) and retried on conflict.
 * `fn` may throw NoChange to skip the write, or return extra campaign columns to update.
 */
export async function mutateCampaign(
  campaignId: string,
  fn: (board: Board, row: CampaignRow) => Partial<Pick<CampaignRow, 'name' | 'status' | 'sessionNumber' | 'inviteCode'>> | void,
): Promise<CampaignRow | null> {
  return serialize(campaignId, async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for('update')
          if (!row) throw new HttpError(404, 'Campaign not found')
          const board = row.board
          const extra = fn(board, row) || {}
          const [updated] = await tx
            .update(campaigns)
            .set({ ...extra, board, version: sql`${campaigns.version} + 1`, updatedAt: new Date() })
            .where(and(eq(campaigns.id, campaignId), eq(campaigns.version, row.version)))
            .returning()
          if (!updated) throw new VersionConflict()
          return updated
        })
      } catch (e) {
        if (e instanceof NoChange) return null
        if (e instanceof VersionConflict && attempt < 6) {
          await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)))
          continue
        }
        throw e
      }
    }
  })
}

export async function bumpVersion(campaignId: string): Promise<CampaignRow | null> {
  const [row] = await db
    .update(campaigns)
    .set({ version: sql`${campaigns.version} + 1` })
    .where(eq(campaigns.id, campaignId))
    .returning()
  return row ?? null
}

export function toChatMessage(m: MessageRow): ChatMessage {
  return {
    id: m.id,
    kind: m.kind as ChatMessage['kind'],
    authorId: m.participantId,
    authorName: m.authorName,
    authorColor: m.authorColor,
    authorRole: (m.authorRole as ChatMessage['authorRole']) ?? null,
    text: m.text,
    roll: m.roll ?? null,
    private: m.dmOnly,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function insertMessage(m: {
  campaignId: string
  participantId: string | null
  authorName: string
  authorColor?: string
  authorRole?: string | null
  kind: 'chat' | 'roll' | 'system'
  text?: string
  roll?: RollResult | null
  dmOnly?: boolean
}): Promise<MessageRow> {
  const [row] = await db
    .insert(messages)
    .values({
      campaignId: m.campaignId,
      participantId: m.participantId,
      authorName: m.authorName,
      authorColor: m.authorColor ?? '#a8998a',
      authorRole: m.authorRole ?? null,
      kind: m.kind,
      text: m.text ?? '',
      roll: m.roll ?? null,
      dmOnly: m.dmOnly ?? false,
    })
    .returning()
  return row
}

export async function recentMessages(campaignId: string, limit = 150): Promise<MessageRow[]> {
  const rows = await db.select().from(messages).where(eq(messages.campaignId, campaignId)).orderBy(desc(messages.id)).limit(limit)
  return rows.reverse()
}

export async function messagesAfter(campaignId: string, afterId: number): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.campaignId, campaignId), gt(messages.id, afterId)))
    .orderBy(asc(messages.id))
    .limit(500)
}

export async function maxMessageId(campaignId: string): Promise<number> {
  const [r] = await db
    .select({ max: sql<number>`coalesce(max(${messages.id}), 0)` })
    .from(messages)
    .where(eq(messages.campaignId, campaignId))
  return Number(r?.max ?? 0)
}

export async function pollVersions(ids: string[]): Promise<{ id: string; version: number; maxMsg: number }[]> {
  if (ids.length === 0) return []
  const rows = await db
    .select({
      id: campaigns.id,
      version: campaigns.version,
      maxMsg: sql<number>`(select coalesce(max(m.id), 0) from "messages" m where m.campaign_id = "campaigns"."id")`,
    })
    .from(campaigns)
    .where(sql`${campaigns.id} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)
  return rows.map((r) => ({ id: r.id, version: Number(r.version), maxMsg: Number(r.maxMsg) }))
}

export async function updateParticipant(id: string, patch: Partial<Pick<ParticipantRow, 'name' | 'avatar' | 'color' | 'canMove' | 'canChat' | 'removed' | 'online' | 'lastSeen'>>) {
  await db.update(participants).set(patch).where(eq(participants.id, id))
}

export async function startSessionRow(campaignId: string, number: number) {
  await db.insert(gameSessions).values({ campaignId, number })
}

export async function endSessionRow(campaignId: string, number: number) {
  await db
    .update(gameSessions)
    .set({ endedAt: new Date() })
    .where(and(eq(gameSessions.campaignId, campaignId), eq(gameSessions.number, number)))
}

export async function resumeSessionRow(campaignId: string, number: number) {
  await db
    .update(gameSessions)
    .set({ endedAt: null })
    .where(and(eq(gameSessions.campaignId, campaignId), eq(gameSessions.number, number)))
}

export async function listSessions(campaignId: string) {
  return db.select().from(gameSessions).where(eq(gameSessions.campaignId, campaignId)).orderBy(desc(gameSessions.number)).limit(50)
}

export async function saveSnapshot(campaignId: string, label: string, board: Board) {
  const [row] = await db.insert(snapshots).values({ campaignId, label, board }).returning({ id: snapshots.id })
  return row.id
}

export async function listSnapshots(campaignId: string) {
  return db
    .select({ id: snapshots.id, label: snapshots.label, createdAt: snapshots.createdAt })
    .from(snapshots)
    .where(eq(snapshots.campaignId, campaignId))
    .orderBy(desc(snapshots.id))
    .limit(30)
}

export async function getSnapshot(campaignId: string, id: number) {
  const [row] = await db.select().from(snapshots).where(and(eq(snapshots.campaignId, campaignId), eq(snapshots.id, id))).limit(1)
  return row ?? null
}

export async function insertCampaign(values: typeof campaigns.$inferInsert) {
  await db.insert(campaigns).values(values)
}

export async function insertParticipant(values: typeof participants.$inferInsert) {
  const [row] = await db.insert(participants).values(values).returning()
  return row
}
