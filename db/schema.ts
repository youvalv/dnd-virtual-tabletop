import { pgTable, serial, text, timestamp, integer, boolean, jsonb, index, bigint } from 'drizzle-orm/pg-core'
import type { Board, RollResult } from '../shared/types.ts'

// One row per campaign. The tabletop state (scenes, tokens, fog, characters,
// initiative, private DM notes) is a single JSONB document that is always read
// and written inside a row-locked transaction, so concurrent edits never clobber
// each other. `version` increments on every change and drives realtime sync.
export const campaigns = pgTable('campaigns', {
  id: text().primaryKey(),
  name: text().notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  status: text().notNull().default('idle'), // idle | live | ended
  sessionNumber: integer('session_number').notNull().default(0),
  board: jsonb().$type<Board>().notNull(),
  version: bigint({ mode: 'number' }).notNull().default(1),
  mapSecret: text('map_secret').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// The DM and every player. Players have no account: they hold a random secret
// (only its SHA-256 hash is stored) that identifies them on reconnect.
export const participants = pgTable(
  'participants',
  {
    id: text().primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    role: text().notNull(), // dm | player
    name: text().notNull(),
    avatar: text().notNull().default('sword'),
    color: text().notNull().default('#d9822b'),
    tokenHash: text('token_hash').notNull(),
    canMove: boolean('can_move').notNull().default(true),
    canChat: boolean('can_chat').notNull().default(true),
    removed: boolean().notNull().default(false),
    online: boolean().notNull().default(false),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('participants_campaign_idx').on(t.campaignId)],
)

export const messages = pgTable(
  'messages',
  {
    id: serial().primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    participantId: text('participant_id'),
    authorName: text('author_name').notNull(),
    authorColor: text('author_color').notNull().default('#a8998a'),
    authorRole: text('author_role'),
    kind: text().notNull(), // chat | roll | system
    text: text().notNull().default(''),
    roll: jsonb().$type<RollResult>(),
    dmOnly: boolean('dm_only').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_campaign_idx').on(t.campaignId, t.id)],
)

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: serial().primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    number: integer().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('game_sessions_campaign_idx').on(t.campaignId)],
)

// Manual save points the DM can restore.
export const snapshots = pgTable(
  'snapshots',
  {
    id: serial().primaryKey(),
    campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    board: jsonb().$type<Board>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('snapshots_campaign_idx').on(t.campaignId)],
)
