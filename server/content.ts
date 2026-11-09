import type { Board, Character, Scene, Token } from '../shared/types.ts'
import { shortId } from './util.ts'

export function emptyFog(cols: number, rows: number, revealed = false): string {
  return (revealed ? '1' : '0').repeat(cols * rows)
}

export function blankScene(name: string, cols = 24, rows = 18): Scene {
  return {
    id: shortId(),
    name,
    cols,
    rows,
    bg: { kind: 'blank' },
    fogEnabled: false,
    revealed: emptyFog(cols, rows, true),
    fogRev: 0,
    hideRev: 0,
    playerMapRev: -1,
    tokens: [],
  }
}

export function makeToken(t: Partial<Token>): Token {
  return {
    id: shortId(),
    name: 'Token',
    kind: 'monster',
    characterId: null,
    ownerId: null,
    x: 0,
    y: 0,
    size: 1,
    color: '#b4443a',
    icon: 'skull',
    hp: 10,
    maxHp: 10,
    ac: 12,
    conditions: [],
    hidden: false,
    dmNotes: '',
    ...t,
  }
}

export function makeCharacter(c: Partial<Character>): Character {
  return {
    id: shortId(),
    name: 'New hero',
    summary: '',
    ownerId: null,
    hp: 10,
    maxHp: 10,
    tempHp: 0,
    ac: 12,
    speed: 30,
    initiativeBonus: 0,
    conditions: [],
    color: '#d9822b',
    icon: 'sword',
    sheet: '',
    dmNotes: '',
    ...c,
  }
}

export function blankBoard(): Board {
  const scene = blankScene('Blank battlefield')
  return {
    scenes: [scene],
    activeSceneId: scene.id,
    characters: [],
    initiative: { round: 0, turn: 0, entries: [] },
    sessionNotes: '',
    guide: null,
  }
}

// ---------------------------------------------------------------------------
// Demo: The Ruined Watchtower (original adventure; monster numbers from SRD 5.2.1)
// Map: 1200x900 px, 24 x 18 squares of 50 px.
// ---------------------------------------------------------------------------

export const DEMO_MAP = { width: 1200, height: 900, cols: 24, rows: 18 }

export function demoBoard(): Board {
  const { cols, rows } = DEMO_MAP
  const fog = Array.from({ length: cols * rows }, (_, i) => {
    const y = Math.floor(i / cols)
    return y >= 15 ? '1' : '0' // only the approach outside the gate is revealed
  }).join('')

  const brenna = makeCharacter({
    name: 'Brenna Ashfall',
    summary: 'Human Fighter, level 1',
    hp: 12, maxHp: 12, ac: 16, speed: 30, initiativeBonus: 1,
    color: '#c9a24a', icon: 'shield',
    sheet:
      'Str 16 (+3) · Dex 13 (+1) · Con 14 (+2) · Int 10 (+0) · Wis 12 (+1) · Cha 10 (+0)\n' +
      'Longsword: +5 to hit, 1d8+3 slashing.\nJavelin: +5 to hit, 1d6+3 piercing, range 30/120 ft.\n' +
      'Second Wind (Bonus Action): regain 1d10+1 HP.\nSkills: Athletics +5, Perception +3.\n' +
      'Plays well for: people who like to stand in front and protect friends.',
    dmNotes: 'Owes a debt to the Millbrook reeve; would love to see the goblins gone.',
  })
  const pip = makeCharacter({
    name: 'Pip Thistledown',
    summary: 'Halfling Rogue, level 1',
    hp: 9, maxHp: 9, ac: 14, speed: 30, initiativeBonus: 3,
    color: '#7d9a6a', icon: 'feather',
    sheet:
      'Str 8 (-1) · Dex 16 (+3) · Con 12 (+1) · Int 13 (+1) · Wis 10 (+0) · Cha 14 (+2)\n' +
      'Shortbow: +5 to hit, 1d6+3 piercing, range 80/320 ft.\nDagger: +5 to hit, 1d4+3 piercing.\n' +
      'Sneak Attack: +1d6 damage once per turn when you have Advantage.\nSkills: Stealth +7, Sleight of Hand +5, Persuasion +4.\n' +
      'Plays well for: sneaky, clever problem-solvers.',
    dmNotes: 'Lost a cousin\'s lucky coin to these goblins. It is in the chest below.',
  })
  const seren = makeCharacter({
    name: 'Seren Vale',
    summary: 'Elf Wizard, level 1',
    hp: 7, maxHp: 7, ac: 12, speed: 30, initiativeBonus: 2,
    color: '#6f8fb3', icon: 'wand-sparkles',
    sheet:
      'Str 8 (-1) · Dex 14 (+2) · Con 12 (+1) · Int 16 (+3) · Wis 12 (+1) · Cha 10 (+0)\n' +
      'Fire Bolt: +5 to hit, 1d10 fire, range 120 ft.\nMagic Missile (1st-level slot, 2 per day): three darts, each hits for 1d4+1 force.\n' +
      'Darkvision 60 ft. Skills: Arcana +5, History +5.\n' +
      'Plays well for: people who enjoy big, flashy choices from a safe distance.',
    dmNotes: 'Recognizes the tower crest from an old book: the Greywatch garrison was buried below.',
  })
  const tomas = makeCharacter({
    name: 'Tomas Hale',
    summary: 'Dwarf Cleric, level 1',
    hp: 11, maxHp: 11, ac: 18, speed: 30, initiativeBonus: 0,
    color: '#b46a4a', icon: 'hammer',
    sheet:
      'Str 14 (+2) · Dex 10 (+0) · Con 14 (+2) · Int 10 (+0) · Wis 16 (+3) · Cha 12 (+1)\n' +
      'Mace: +4 to hit, 1d6+2 bludgeoning.\nSacred Flame: target makes a DC 13 Dexterity save or takes 1d8 radiant.\n' +
      'Healing Word (Bonus Action, 60 ft): a creature regains 2d4+3 HP.\nDarkvision 60 ft. Skills: Medicine +5, Insight +5.\n' +
      'Plays well for: people who like keeping the team on their feet.',
    dmNotes: 'Senses something unquiet beneath the tower when within 30 ft of the stairs.',
  })
  const characters = [brenna, pip, seren, tomas]

  const pcTokens = characters.map((c, i) =>
    makeToken({
      name: c.name.split(' ')[0],
      kind: 'pc',
      characterId: c.id,
      x: [11, 12, 11, 13][i],
      y: [16, 16, 17, 17][i],
      color: c.color,
      icon: c.icon,
      hp: c.hp,
      maxHp: c.maxHp,
      ac: c.ac,
    }),
  )

  const goblin = (name: string, x: number, y: number, notes: string) =>
    makeToken({ name, kind: 'monster', x, y, hp: 10, maxHp: 10, ac: 15, icon: 'skull', color: '#8a9a3a', dmNotes: `Goblin Warrior (SRD 5.2.1). AC 15, HP 10, Speed 30 ft. Scimitar +4, 1d6+2 slashing; Shortbow +4, 1d6+2 piercing. Nimble Escape: Disengage or Hide as a Bonus Action. ${notes}` })

  const monsters: Token[] = [
    goblin('Goblin Sentry', 10, 13, 'Dozing against the wall just inside the gate.'),
    goblin('Goblin Cook', 6, 10, 'Stirring a pot of something unpleasant by the fire.'),
    goblin('Goblin Lookout', 8, 12, 'Counting stolen coins on a crate.'),
    makeToken({
      name: 'Grisk Halfear', kind: 'monster', x: 15, y: 9, hp: 21, maxHp: 21, ac: 17, icon: 'crown', color: '#a3562e',
      dmNotes: 'Goblin Boss (SRD 5.2.1). AC 17, HP 21, Speed 30 ft. Multiattack: two Scimitar attacks, +4 to hit, 1d6+2 slashing. Cowardly: offers a deal when bloodied.',
    }),
    makeToken({
      name: 'Skeleton', kind: 'monster', x: 16, y: 4, hp: 13, maxHp: 13, ac: 14, icon: 'bone', color: '#9c9486', hidden: true,
      dmNotes: 'Skeleton (SRD 5.2.1). AC 14, HP 13, Speed 30 ft. Shortsword +5, 1d6+3 piercing; Shortbow +5, 1d6+3. Vulnerable to bludgeoning. Rises from the stairs in step 4.',
    }),
    makeToken({
      name: 'Skeleton', kind: 'monster', x: 18, y: 6, hp: 13, maxHp: 13, ac: 14, icon: 'bone', color: '#9c9486', hidden: true,
      dmNotes: 'Skeleton (SRD 5.2.1). AC 14, HP 13. Wears the rusted crest of the Greywatch garrison.',
    }),
  ]

  const tower: Scene = {
    id: shortId(),
    name: 'The Ruined Watchtower',
    cols,
    rows,
    bg: { kind: 'image', width: DEMO_MAP.width, height: DEMO_MAP.height, rev: 1 },
    fogEnabled: true,
    revealed: fog,
    fogRev: 1,
    hideRev: 1,
    playerMapRev: -1,
    tokens: [...pcTokens, ...monsters],
  }

  const crypt = blankScene('The Crypt Below', 14, 10)
  crypt.fogEnabled = false
  crypt.tokens = [
    makeToken({ name: 'Old Chest', kind: 'npc', x: 10, y: 4, hp: 1, maxHp: 1, ac: 10, icon: 'gem', color: '#c9a24a', dmNotes: '50 gp, a Potion of Healing (2d4+2), Pip\'s cousin\'s lucky coin, and the watch captain\'s signet ring.' }),
  ]

  return {
    scenes: [tower, crypt],
    activeSceneId: tower.id,
    characters,
    initiative: { round: 0, turn: 0, entries: [] },
    sessionNotes: '',
    guide: {
      title: 'The Ruined Watchtower',
      overview:
        'A one-shot for four level 1 characters that takes about 60 to 90 minutes. A small band of goblins led by Grisk Halfear has taken over the ruins of Greywatch, an old watchtower above the village of Millbrook, and has been raiding supply carts. The party has been hired to drive them out. Nobody in Millbrook remembers that the garrison was buried in the crypt below the tower, and the dead do not like noise.',
      readAloud:
        'The cart track climbs through damp pines until the trees fall away and the hilltop opens up. Ahead stands what is left of Greywatch: a broken square of mossy walls and, in the far corner, the stump of a round stone tower. Cook smoke drifts over the wall. The gate has collapsed into splintered planks, and somewhere inside, someone is laughing in a harsh, high-pitched voice.',
      flow: [
        {
          title: '1. The broken gate',
          text: 'Ask each player what their character does as they approach. A goblin sentry dozes just inside the gate (hidden under fog). A careful approach is a group Dexterity (Stealth) check, DC 10: if most succeed, the party gets the first move. If not, the sentry yelps an alarm. Reveal the gate area with the fog brush when they look inside.',
        },
        {
          title: '2. Skirmish in the courtyard',
          text: 'Reveal the courtyard. The cook and the lookout grab their weapons. Open the Encounter tab, add the scene tokens to initiative and roll for monsters, then ask the players to roll initiative (1d20 + their bonus). Goblins duck behind crates and run when bloodied. Use this fight to teach attack rolls versus AC and rolling damage.',
        },
        {
          title: '3. Grisk Halfear',
          text: 'At the end of round 2, or when two goblins fall, Grisk swaggers out of the tower doorway. Once he is bloodied he begs for a deal: "Shiny coins, and Grisk goes away forever!" A DC 15 Charisma (Persuasion or Intimidation) check can end the fight without more blood.',
        },
        {
          title: '4. What stirs below',
          text: 'When someone steps into the tower, or Grisk is dealt with, the two skeletons climb out of the spiral stair. Reveal the tower and un-hide them (eye icon on each token). They fight until destroyed. Bludgeoning weapons, like Tomas\'s mace, are especially effective.',
        },
        {
          title: '5. The crypt and wrap-up',
          text: 'Switch to "The Crypt Below" scene. An old chest holds 50 gp, a Potion of Healing, a lucky coin, and the signet ring of the last watch captain, whose engraved name points toward a second adventure. Thank everyone and ask what they enjoyed most.',
        },
      ],
      tips: [
        'Players only see what you reveal: fogged squares, hidden tokens, these notes, and your private rolls never leave the server for them.',
        'New players: ask "What do you want to do?", then tell them what to roll. They do not need to know the rules first.',
        'Describe misses as near-misses, and let a natural 20 feel big.',
        'If the party is struggling, have a goblin flee or surrender. The goal is fun, not a total party wipe.',
      ],
    },
  }
}
