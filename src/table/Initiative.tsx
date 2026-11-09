import type { BoardView, CharacterView, ParticipantView, YouInfo } from '../../shared/types.ts'
import { Avatar } from '../lib/icons.tsx'

export function InitiativeStrip({ board, you }: { board: BoardView; you: YouInfo }) {
  const ini = board.initiative
  if (ini.entries.length === 0) return null
  const tokens = board.scene?.tokens ?? []
  return (
    <div className="init-strip" aria-label="Turn order">
      <span className="init-round">{ini.round === 0 ? 'Rolling initiative' : `Round ${ini.round}`}</span>
      {ini.entries.map((e) => {
        const t = tokens.find((x) => x.id === e.tokenId)
        const ch = board.characters.find((c) => c.id === e.characterId)
        const mine = ch?.ownerId === you.participantId
        return (
          <span key={e.id} className={`init-chip ${e.kind} ${ini.currentId === e.id ? 'cur' : ''}`} title={mine && ini.currentId === e.id ? 'Your turn!' : undefined}>
            <Avatar icon={t?.icon ?? ch?.icon ?? 'user'} color={t?.color ?? ch?.color ?? '#a8998a'} size={20} />
            {mine ? <strong style={{ color: 'var(--ember-2)' }}>{e.name.split(' ')[0]}</strong> : e.kind === 'pc' ? e.name.split(' ')[0] : e.name}
            <span className="v">{e.value}</span>
          </span>
        )
      })}
      {ini.hiddenTurn && <span className="init-chip cur">Something stirs...</span>}
    </div>
  )
}

export function yourTurn(board: BoardView, you: YouInfo) {
  const cur = board.initiative.entries.find((e) => e.id === board.initiative.currentId)
  if (!cur || board.initiative.round === 0) return false
  const ch = board.characters.find((c) => c.id === cur.characterId)
  return ch?.ownerId === you.participantId
}

export function ownerName(ch: CharacterView, participants: ParticipantView[]) {
  return participants.find((p) => p.id === ch.ownerId)?.name ?? null
}
