// Shared presets used by the DM tools and validated by the server.

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
  // Common table states that are not SRD conditions but are handy to track
  'Concentrating', 'Bloodied', 'Hidden', 'Dodging',
]

export const AVATARS = [
  'sword', 'shield', 'wand-sparkles', 'bow-arrow', 'hammer', 'axe', 'feather', 'flame',
  'leaf', 'moon', 'music', 'book-open', 'gem', 'crown', 'cat', 'bird',
]

export const TOKEN_COLORS = ['#d9822b', '#c9a24a', '#7d9a6a', '#6f8fb3', '#9a7bb0', '#b46a4a', '#b4443a', '#5a9a94', '#a8998a', '#8a9a3a']

// Quick monster presets. Numbers follow the SRD 5.2.1 stat blocks (AC, average HP).
export interface MonsterPreset {
  key: string
  name: string
  ac: number
  hp: number
  icon: string
  color: string
  size: number
  note: string
}

export const MONSTER_PRESETS: MonsterPreset[] = [
  { key: 'goblin-warrior', name: 'Goblin Warrior', ac: 15, hp: 10, icon: 'skull', color: '#8a9a3a', size: 1, note: 'Scimitar +4, 1d6+2 slashing. Nimble Escape.' },
  { key: 'goblin-boss', name: 'Goblin Boss', ac: 17, hp: 21, icon: 'crown', color: '#a3562e', size: 1, note: 'Two Scimitar attacks, +4 to hit, 1d6+2.' },
  { key: 'skeleton', name: 'Skeleton', ac: 14, hp: 13, icon: 'bone', color: '#9c9486', size: 1, note: 'Shortsword +5, 1d6+3. Vulnerable to bludgeoning.' },
  { key: 'zombie', name: 'Zombie', ac: 8, hp: 15, icon: 'ghost', color: '#6f7a5a', size: 1, note: 'Slam +3, 1d8+1. Undead Fortitude.' },
  { key: 'wolf', name: 'Wolf', ac: 12, hp: 11, icon: 'paw-print', color: '#7a6f66', size: 1, note: 'Bite +4, 1d6+2; can knock Prone. Pack Tactics.' },
  { key: 'bandit', name: 'Bandit', ac: 12, hp: 11, icon: 'swords', color: '#8a5a44', size: 1, note: 'Scimitar +3, 1d6+1.' },
  { key: 'cultist', name: 'Cultist', ac: 12, hp: 9, icon: 'flame', color: '#7d3b4a', size: 1, note: 'Ritual Sickle +3, 1d4+1.' },
  { key: 'giant-spider', name: 'Giant Spider', ac: 14, hp: 26, icon: 'bug', color: '#4d4a5a', size: 2, note: 'Bite +5, poison. Web.' },
  { key: 'ogre', name: 'Ogre', ac: 11, hp: 68, icon: 'mountain', color: '#7a6040', size: 2, note: 'Greatclub +6, 2d8+4 bludgeoning.' },
  { key: 'commoner', name: 'Commoner (NPC)', ac: 10, hp: 4, icon: 'user', color: '#a8998a', size: 1, note: 'Club +2, 1d4.' },
]
