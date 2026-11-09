// Types shared by the browser client and the Netlify Server.
// "Board" types describe the authoritative state stored in the database.
// "View" types describe what a specific client is allowed to see.

export type Role = 'dm' | 'player'
export type SessionStatus = 'idle' | 'live' | 'ended'
export type TokenKind = 'pc' | 'monster' | 'npc'

export interface Token {
  id: string
  name: string
  kind: TokenKind
  characterId?: string | null // PCs: stats come from the character
  ownerId?: string | null // participant allowed to move this token (besides the DM)
  x: number // grid cell column
  y: number // grid cell row
  size: number // 1 = medium, 2 = large, 3 = huge
  color: string
  icon: string
  hp: number
  maxHp: number
  ac: number
  conditions: string[]
  hidden: boolean
  dmNotes: string
}

export interface SceneBackgroundBlank {
  kind: 'blank'
}
export interface SceneBackgroundImage {
  kind: 'image'
  width: number
  height: number
  rev: number // bumps each time a new image is uploaded
}

export interface Scene {
  id: string
  name: string
  cols: number
  rows: number
  bg: SceneBackgroundBlank | SceneBackgroundImage
  fogEnabled: boolean
  revealed: string // cols*rows chars, '1' = revealed
  fogRev: number // bumps on every fog change
  hideRev: number // fogRev of the most recent change that hid cells
  playerMapRev: number // fogRev the stored player (masked) image was rendered for, -1 = none
  tokens: Token[]
}

export interface Character {
  id: string
  name: string
  summary: string // e.g. "Human Fighter, level 1"
  ownerId: string | null
  hp: number
  maxHp: number
  tempHp: number
  ac: number
  speed: number
  initiativeBonus: number
  conditions: string[]
  color: string
  icon: string
  sheet: string // short free-form character sheet notes visible to the party
  dmNotes: string // private to the DM
}

export interface InitiativeEntry {
  id: string
  name: string
  value: number
  tokenId: string | null
  characterId: string | null
  kind: TokenKind
}

export interface Initiative {
  round: number
  turn: number // index into entries (entries are kept sorted)
  entries: InitiativeEntry[]
}

export interface DmGuide {
  title: string
  overview: string
  readAloud: string
  flow: { title: string; text: string }[]
  tips: string[]
}

export interface Board {
  scenes: Scene[]
  activeSceneId: string
  characters: Character[]
  initiative: Initiative
  sessionNotes: string // private DM notes
  guide: DmGuide | null // private DM guide (demo)
}

// ---------- Views sent to clients ----------

export interface TokenView extends Omit<Token, 'hp' | 'maxHp' | 'ac' | 'dmNotes'> {
  hp: number | null // null when hidden from this viewer
  maxHp: number | null
  ac: number | null
  health: number // 0..4, coarse health indicator always available
  dmNotes?: string
}

export interface SceneView {
  id: string
  name: string
  cols: number
  rows: number
  bg: Scene['bg']
  fogEnabled: boolean
  revealed: string
  fogRev: number
  playerMapRev: number
  hideRev: number
  mapUrl: string | null // URL this viewer may load, already signed
  mapPending: boolean // there is an image but no safe version for this viewer yet
  tokens: TokenView[]
}

export interface CharacterView extends Omit<Character, 'dmNotes'> {
  dmNotes?: string
}

export interface InitiativeView {
  round: number
  entries: InitiativeEntry[]
  currentId: string | null
  hiddenTurn: boolean
}

export interface ParticipantView {
  id: string
  name: string
  role: Role
  avatar: string
  color: string
  online: boolean
  canMove: boolean
  canChat: boolean
}

export interface SceneSummary {
  id: string
  name: string
  cols: number
  rows: number
  hasImage: boolean
  fogEnabled: boolean
  tokenCount: number
}

export interface CampaignMeta {
  id: string
  name: string
  status: SessionStatus
  sessionNumber: number
  isDemo: boolean
  inviteCode?: string // DM only
}

export interface BoardView {
  scene: SceneView | null
  characters: CharacterView[]
  initiative: InitiativeView
  // DM-only extras
  scenes?: SceneSummary[]
  activeSceneId?: string
  sessionNotes?: string
  guide?: DmGuide | null
  editingSceneId?: string
}

export interface DieRoll {
  value: number
  kept: boolean
}
export interface RollTerm {
  kind: 'dice' | 'mod'
  sign: 1 | -1
  count?: number
  sides?: number
  keep?: string
  rolls?: DieRoll[]
  value: number
}
export interface RollResult {
  expr: string
  total: number
  terms: RollTerm[]
  natural: 'crit' | 'fumble' | null
  label?: string
}

export interface ChatMessage {
  id: number
  kind: 'chat' | 'roll' | 'system'
  authorId: string | null
  authorName: string
  authorColor: string
  authorRole: Role | null
  text: string
  roll: RollResult | null
  private: boolean
  createdAt: string
}

export interface YouInfo {
  participantId: string
  role: Role
  name: string
}

// ---------- Wire protocol ----------

export type ClientOp =
  | { type: 'token.move'; tokenId: string; x: number; y: number }
  | { type: 'token.drag'; tokenId: string; x: number; y: number }
  | { type: 'token.update'; tokenId: string; patch: Partial<Pick<Token, 'name' | 'hp' | 'maxHp' | 'ac' | 'conditions' | 'hidden' | 'size' | 'color' | 'dmNotes' | 'ownerId' | 'icon' | 'kind'>> }
  | { type: 'token.add'; tokens: Partial<Token>[] }
  | { type: 'token.remove'; tokenId: string }
  | { type: 'character.update'; characterId: string; patch: Partial<Omit<Character, 'id'>> }
  | { type: 'character.add'; character: Partial<Character>; place?: boolean }
  | { type: 'character.remove'; characterId: string }
  | { type: 'character.claim'; characterId: string }
  | { type: 'character.release'; characterId: string }
  | { type: 'fog.paint'; sceneId: string; cells: number[]; reveal: boolean }
  | { type: 'fog.all'; sceneId: string; reveal: boolean }
  | { type: 'fog.enable'; sceneId: string; enabled: boolean }
  | { type: 'scene.add'; name: string; cols: number; rows: number }
  | { type: 'scene.update'; sceneId: string; patch: { name?: string; cols?: number; rows?: number } }
  | { type: 'scene.activate'; sceneId: string }
  | { type: 'scene.edit'; sceneId: string }
  | { type: 'scene.remove'; sceneId: string }
  | { type: 'initiative.add'; tokenIds?: string[]; characterIds?: string[]; name?: string; value?: number }
  | { type: 'initiative.set'; entryId: string; value: number }
  | { type: 'initiative.remove'; entryId: string }
  | { type: 'initiative.rollMonsters' }
  | { type: 'initiative.rollSelf'; entryId: string }
  | { type: 'initiative.next' }
  | { type: 'initiative.prev' }
  | { type: 'initiative.clear' }
  | { type: 'chat.send'; text: string }
  | { type: 'dice.roll'; expr: string; label?: string; private?: boolean }
  | { type: 'ping'; x: number; y: number }
  | { type: 'notes.update'; text: string }
  | { type: 'session.start' }
  | { type: 'session.end' }
  | { type: 'session.resume' }
  | { type: 'participant.update'; participantId: string; patch: { canMove?: boolean; canChat?: boolean } }
  | { type: 'participant.remove'; participantId: string }
  | { type: 'invite.regenerate' }
  | { type: 'campaign.rename'; name: string }
  | { type: 'me.update'; name?: string; avatar?: string; color?: string }
  | { type: 'snapshot.save'; label: string }
  | { type: 'snapshot.restore'; snapshotId: number }

export type ClientMessage =
  | { type: 'hello'; campaignId: string; token: string; lastMessageId?: number }
  | { type: 'op'; reqId?: number; op: ClientOp }
  | { type: 'heartbeat' }

export interface PingEvent {
  sceneId: string
  x: number
  y: number
  color: string
  name: string
}

export type ServerMessage =
  | { type: 'welcome'; you: YouInfo; campaign: CampaignMeta; board: BoardView; participants: ParticipantView[]; messages: ChatMessage[]; version: number }
  | { type: 'state'; campaign: CampaignMeta; board: BoardView; participants: ParticipantView[]; version: number }
  | { type: 'messages'; messages: ChatMessage[] }
  | { type: 'ping'; ping: PingEvent }
  | { type: 'drag'; sceneId: string; tokenId: string; x: number; y: number }
  | { type: 'ack'; reqId: number; ok: boolean; error?: string }
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'kicked' }
