// Beginner learning content for the virtual tabletop.
//
// Rules content is based on the System Reference Document 5.2.1 (SRD 5.2.1),
// licensed under CC BY 4.0. See SRD_ATTRIBUTION below. Do not add material
// from outside the SRD 5.2.1 (non-SRD subclasses, spells, monsters, settings,
// or Product Identity creatures).
//
// Text strings support **bold** only.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] } // numbered
  | { type: 'callout'; title: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface LearnSection {
  id: string
  title: string
  kicker: string
  summary: string
  blocks: Block[]
}

export interface RefEntry {
  id: string
  term: string
  category: 'Condition' | 'Rule' | 'Combat' | 'Action' | 'Dice' | 'Resting'
  summary: string
  details: string[]
  keywords?: string[]
}

export interface Resource {
  title: string
  url: string
  description: string
  kind: 'Official' | 'Tool' | 'Guide' | 'License'
}

export const SRD_ATTRIBUTION: string =
  "This work includes material from the System Reference Document 5.2.1 (\"SRD 5.2.1\") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode."

export const CONDITION_NAMES: string[] = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]

// ---------------------------------------------------------------------------
// Learn sections
// ---------------------------------------------------------------------------

export const learnSections: LearnSection[] = [
  {
    id: 'what-is-dnd',
    title: 'What is D&D?',
    kicker: 'Start here',
    summary:
      'A cooperative storytelling game: one person runs the world, everyone else plays a hero, and dice settle anything uncertain.',
    blocks: [
      {
        type: 'p',
        text: "Dungeons & Dragons is a game of **collaborative storytelling**. Each player controls one character, a hero in a fantasy world. One person, the **Dungeon Master (DM)**, describes the world, plays everyone else in it, and referees the rules.",
      },
      {
        type: 'callout',
        title: 'DM or GM?',
        text: 'The official rules reference (SRD 5.2.1) calls this role the **Game Master (GM)**. It is the same job. This app says DM.',
      },
      {
        type: 'p',
        text: "When the outcome of something is uncertain, you **roll dice**, usually a twenty-sided die (a d20) plus a bonus from your character sheet. Higher is better. If success is certain or failure wouldn't matter, nobody rolls.",
      },
      {
        type: 'p',
        text: "There is **no winning or losing**. The group works together toward goals set by the story. Characters can fail, get hurt, or make bad deals, and that is often where the best moments come from. The game succeeds if everyone had a good time.",
      },
      {
        type: 'p',
        text: '**What a session looks like.** Play is a simple loop that repeats all evening:',
      },
      {
        type: 'steps',
        items: [
          '**The DM describes a scene:** where you are, what you see, who is there.',
          '**Players say what their characters do:** talk to someone, search a room, open a door, attack.',
          '**The DM narrates the result.** If the outcome is uncertain, the DM asks someone to roll first. Then the loop starts again.',
        ],
      },
      {
        type: 'p',
        text: 'Scenes fall into three broad kinds: **social interaction** (talking with characters the DM plays), **exploration** (moving through and poking at the world), and **combat** (a structured, turn-by-turn fight). Most sessions mix all three.',
      },
      {
        type: 'p',
        text: 'A single story is an **adventure**. A series of adventures with the same characters is a **campaign**. A story finished in one session is often called a **one-shot**, which is the best way to try the game.',
      },
      {
        type: 'callout',
        title: 'What you need to play in this app',
        text: 'A web browser and a voice call on whatever tool your team already uses. The app handles the map, tokens, dice, and chat, so you do not need physical dice, books, or miniatures. You also need a character; ask your DM for a pre-made one.',
      },
    ],
  },

  {
    id: 'characters',
    title: 'Characters',
    kicker: 'Who you play',
    summary:
      'Your character is a class, a species, and a background, plus six ability scores and a few key numbers: Hit Points, Armor Class, and Proficiency Bonus.',
    blocks: [
      {
        type: 'p',
        text: 'A character is built from three big choices. Each one hands you abilities, proficiencies, and story hooks.',
      },
      {
        type: 'list',
        items: [
          '**Class:** what your character does in a fight and beyond. The SRD classes are Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, and Wizard. Fighter and Rogue are the simplest to learn.',
          '**Species:** your people, such as Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, or Tiefling. Species gives traits like Darkvision and sets your size and Speed.',
          '**Background:** what you did before adventuring, such as Acolyte, Criminal, Sage, or Soldier. It gives two skill proficiencies, a tool proficiency, a starting feat, and increases to some ability scores.',
        ],
      },
      {
        type: 'p',
        text: 'Characters usually start at **level 1** and gain levels (up to 20) as they adventure. Each level adds Hit Points and new features. Your DM tells you when to level up.',
      },
      {
        type: 'p',
        text: '**The six abilities.** Every creature, hero or monster, has the same six:',
      },
      {
        type: 'table',
        head: ['Ability', 'Measures', 'Roll it to...'],
        rows: [
          ['Strength (Str)', 'Physical might', 'Lift, push, pull, or break something'],
          ['Dexterity (Dex)', 'Agility, reflexes, and balance', 'Move nimbly, quickly, or quietly'],
          ['Constitution (Con)', 'Health and stamina', 'Push your body beyond normal limits'],
          ['Intelligence (Int)', 'Reasoning and memory', 'Reason something out or remember it'],
          ['Wisdom (Wis)', 'Perceptiveness and mental fortitude', 'Notice things in the world or in people'],
          ['Charisma (Cha)', 'Confidence, poise, and charm', 'Influence, entertain, or deceive'],
        ],
      },
      {
        type: 'p',
        text: 'Each ability has a **score** (for starting heroes, roughly 8 to 17) and a **modifier** derived from it. You almost always use the **modifier**, not the score. Quick formula: subtract 10, divide by 2, round down.',
      },
      {
        type: 'table',
        head: ['Score', 'Modifier'],
        rows: [
          ['1', '-5'],
          ['2-3', '-4'],
          ['4-5', '-3'],
          ['6-7', '-2'],
          ['8-9', '-1'],
          ['10-11', '+0'],
          ['12-13', '+1'],
          ['14-15', '+2'],
          ['16-17', '+3'],
          ['18-19', '+4'],
          ['20-21', '+5'],
          ['22+', '+1 more per 2 points (max +10 at 30)'],
        ],
      },
      {
        type: 'p',
        text: '**Proficiency Bonus** is a flat bonus you add to things your character is trained in: certain skills, saving throws, weapons, tools, and spell attacks. It is **+2 at levels 1-4**, and grows to +3 at level 5, +4 at 9, +5 at 13, and +6 at 17. You never add it more than once to the same roll.',
      },
      {
        type: 'p',
        text: '**Hit Points (HP)** measure how much punishment you can take. Damage lowers them, healing restores them, and you can never go above your maximum. At level 1 your maximum is a number set by your class plus your Con modifier (for example, Fighter 10 + Con, Wizard 6 + Con). At 0 HP you fall unconscious; see Combat.',
      },
      {
        type: 'p',
        text: '**Armor Class (AC)** is how hard you are to hit. An attack hits if its total equals or beats your AC. With no armor it is 10 + your Dex modifier; armor, shields, and some class features change it.',
      },
      {
        type: 'p',
        text: '**Speed** is how far you can move on your turn, usually **30 feet** (6 squares on the map).',
      },
      {
        type: 'callout',
        title: 'Tip: pick a pre-made character',
        text: 'For your first game, ask your DM for a **pre-made character** instead of building one. On your sheet, find just five things: **HP**, **AC**, your **main attack**, your **best skills**, and **one special thing** your class can do. Learn the rest by playing. Building from scratch makes much more sense after a session or two.',
      },
    ],
  },

  {
    id: 'ability-checks',
    title: 'Ability checks & D20 Tests',
    kicker: 'The core mechanic',
    summary:
      'Almost every roll is a D20 Test: roll a d20, add a modifier, and try to meet or beat a target number.',
    blocks: [
      {
        type: 'p',
        text: 'When the outcome is uncertain, the DM calls for a **D20 Test**. There are three kinds: **ability checks**, **saving throws**, and **attack rolls**. They all work the same way:',
      },
      {
        type: 'steps',
        items: [
          '**Roll a d20.**',
          '**Add the relevant ability modifier** (Strength, Dexterity, and so on).',
          '**Add your Proficiency Bonus** if you are proficient in the skill, save, weapon, or tool being used.',
          '**Add any other bonuses or penalties** from spells, features, or conditions.',
          '**Compare to the target number.** Equal or higher succeeds. The target is a **Difficulty Class (DC)** for checks and saves, and the target\'s **Armor Class (AC)** for attacks.',
        ],
      },
      {
        type: 'callout',
        title: 'Example',
        text: 'You try to climb a slick cliff. The DM asks for a **Strength (Athletics) check, DC 15**. You roll an 11, add +2 for Strength and +2 for your Athletics proficiency: 11 + 2 + 2 = **15**. You make it.',
      },
      {
        type: 'p',
        text: '**Ability checks** cover anything that is not an attack: picking a lock, spotting an ambush, recalling lore, persuading a guard. The DM sets the DC based on how hard the task is.',
      },
      {
        type: 'table',
        head: ['Task difficulty', 'DC'],
        rows: [
          ['Very easy', '5'],
          ['Easy', '10'],
          ['Medium', '15'],
          ['Hard', '20'],
          ['Very hard', '25'],
          ['Nearly impossible', '30'],
        ],
      },
      {
        type: 'p',
        text: '**Saving throws** ("saves") are how you resist something happening to you: diving away from an explosion (Dexterity), enduring poison (Constitution), or shrugging off a spell aimed at your mind (Wisdom). The effect or the DM sets the DC. Your class makes you proficient in at least two kinds of save.',
      },
      {
        type: 'p',
        text: '**Attack rolls** decide whether an attack hits. Use Strength for melee weapons, Dexterity for ranged weapons, and your spellcasting ability for spell attacks. Add your Proficiency Bonus if you are proficient with the weapon (always for spell attacks). You hit if the total equals or beats the target\'s AC.',
      },
      {
        type: 'callout',
        title: 'Natural 20 and natural 1',
        text: 'A "natural" roll is the number the die actually shows. On an **attack roll**, a **natural 20** always hits and is a **Critical Hit**, and a **natural 1** always misses. Under these rules, a 20 or 1 on an ability check or saving throw has no special effect; just add your modifiers as usual (some groups house-rule this).',
      },
      {
        type: 'p',
        text: '**Advantage and Disadvantage.** Good circumstances give **Advantage**: roll two d20s and use the higher. Bad circumstances give **Disadvantage**: roll two and use the lower. Multiple sources do not stack (you still roll only two dice), and if you have both, they cancel out and you roll one d20.',
      },
      {
        type: 'p',
        text: '**Skills.** Most ability checks use a skill, written like "Wisdom (Perception)". If you are proficient in the skill, add your Proficiency Bonus. If not, you can still roll; you just do not add it.',
      },
      {
        type: 'table',
        head: ['Skill', 'Ability', 'Use it to...'],
        rows: [
          ['Acrobatics', 'Dex', 'Stay on your feet or perform a stunt'],
          ['Animal Handling', 'Wis', 'Calm, train, or direct an animal'],
          ['Arcana', 'Int', 'Recall lore about magic and the planes'],
          ['Athletics', 'Str', 'Climb, jump, swim, or break something'],
          ['Deception', 'Cha', 'Lie convincingly or wear a disguise'],
          ['History', 'Int', 'Recall events, people, and cultures'],
          ['Insight', 'Wis', 'Read someone\'s mood and intentions'],
          ['Intimidation', 'Cha', 'Threaten or awe someone'],
          ['Investigation', 'Int', 'Deduce how something works or find clues'],
          ['Medicine', 'Wis', 'Diagnose illness or stabilize the dying'],
          ['Nature', 'Int', 'Recall lore about terrain, plants, animals, weather'],
          ['Perception', 'Wis', 'Notice something easy to miss'],
          ['Performance', 'Cha', 'Act, tell a story, play music, or dance'],
          ['Persuasion', 'Cha', 'Honestly convince someone'],
          ['Religion', 'Int', 'Recall lore about gods, rites, and holy symbols'],
          ['Sleight of Hand', 'Dex', 'Pick a pocket or hide an object on you'],
          ['Stealth', 'Dex', 'Move quietly and stay out of sight'],
          ['Survival', 'Wis', 'Track, forage, or find your way'],
        ],
      },
    ],
  },

  {
    id: 'combat',
    title: 'Combat',
    kicker: 'Turn by turn',
    summary:
      'Fights run in rounds of about 6 seconds. On your turn you move, take one action, and maybe a Bonus Action; you also get one Reaction per round.',
    blocks: [
      {
        type: 'p',
        text: 'When a fight breaks out, the game switches from free-form conversation to a structured sequence:',
      },
      {
        type: 'steps',
        items: [
          '**Establish positions.** The DM places everyone\'s tokens on the map.',
          '**Roll Initiative.** Everyone makes a Dexterity check; the DM rolls for monsters. This sets the turn order, highest first, and it stays the same for the whole fight.',
          '**Take turns.** Each creature acts in Initiative order. When everyone has gone, the **round** ends (about 6 seconds of game time) and a new one starts at the top.',
          '**Repeat until the fight ends:** one side is defeated, flees, or surrenders, or both sides agree to stop.',
        ],
      },
      {
        type: 'callout',
        title: 'Surprise',
        text: 'If you are caught unaware when combat starts (for example, ambushed by hidden enemies), you have **Disadvantage on your Initiative roll**. That is the whole rule; you do not lose your turn.',
      },
      {
        type: 'p',
        text: '**On your turn you can:**',
      },
      {
        type: 'list',
        items: [
          '**Move** up to your Speed. You can split movement before and after your action.',
          '**Take one action** from the list below, or something you improvise.',
          '**Take one Bonus Action**, but only if a feature or spell specifically gives you one.',
          '**Interact with one object for free**, like opening a door or drawing a weapon, and speak a few words.',
          'You also get **one Reaction per round**, usable even on other creatures\' turns. It comes back at the start of your turn.',
        ],
      },
      {
        type: 'table',
        head: ['Action', 'What it does'],
        rows: [
          ['Attack', 'Make an attack with a weapon or an Unarmed Strike.'],
          ['Dash', 'Gain extra movement equal to your Speed this turn.'],
          ['Disengage', 'Your movement does not provoke Opportunity Attacks this turn.'],
          ['Dodge', 'Until your next turn, attacks against you have Disadvantage (if you can see the attacker) and you have Advantage on Dex saves.'],
          ['Help', 'Give an ally Advantage on a check or an attack, or give first aid to a dying creature.'],
          ['Hide', 'Make a DC 15 Dexterity (Stealth) check to become hidden.'],
          ['Influence', 'Try to change a creature\'s attitude with a Charisma or Wisdom check.'],
          ['Magic', 'Cast a spell, use a magic item, or use a magical feature.'],
          ['Ready', 'Choose a trigger and an action; take it as a Reaction when the trigger happens.'],
          ['Search', 'Make a Wisdom check (Insight, Medicine, Perception, or Survival).'],
          ['Study', 'Make an Intelligence check (Arcana, History, Investigation, Nature, or Religion).'],
          ['Utilize', 'Use a nonmagical object that takes an action, like a stuck door or a crank.'],
        ],
      },
      {
        type: 'p',
        text: '**Attacking.** Make an attack roll against the target\'s AC. On a hit, roll the weapon\'s damage dice and add the same ability modifier you used for the attack roll. The target subtracts that from its HP.',
      },
      {
        type: 'callout',
        title: 'Critical Hits',
        text: 'A natural 20 on an attack roll is a **Critical Hit**. Roll all of the attack\'s **damage dice twice**, then add modifiers once. A Dagger crit deals 2d4 + modifier instead of 1d4 + modifier.',
      },
      {
        type: 'p',
        text: '**Dropping to 0 HP.** Monsters usually die at 0 HP. A character instead falls **Unconscious** and starts making **Death Saving Throws** at the start of each of their turns:',
      },
      {
        type: 'list',
        items: [
          'Roll a d20 with no modifiers. **10 or higher is a success**; 9 or lower is a failure.',
          '**Three successes:** you become Stable (still unconscious at 0 HP, but no longer rolling).',
          '**Three failures:** your character dies. Successes and failures do not need to be in a row.',
          '**Natural 20:** you regain 1 HP and wake up. **Natural 1:** counts as two failures.',
          'Taking damage at 0 HP is one failure (two if it was a Critical Hit). Any healing brings you back and resets the count.',
        ],
      },
      {
        type: 'callout',
        title: 'Saving a fallen ally',
        text: 'Any healing gets them back up. Without magic, take the **Help** action and make a **DC 10 Wisdom (Medicine)** check to stabilize them.',
      },
      {
        type: 'p',
        text: '**Opportunity Attacks.** If an enemy you can see leaves your reach (usually 5 feet), you can use your Reaction to make one melee attack against it just before it leaves. The same applies to you, which is why the **Disengage** action exists. Being pushed or teleported does not provoke one.',
      },
      {
        type: 'p',
        text: '**Cover.** Walls, trees, and even other creatures can protect a target:',
      },
      {
        type: 'table',
        head: ['Cover', 'Benefit to the target', 'Typical source'],
        rows: [
          ['Half', '+2 to AC and Dexterity saves', 'A creature or object covering at least half the target'],
          ['Three-quarters', '+5 to AC and Dexterity saves', 'An object covering at least three-quarters, like an arrow slit'],
          ['Total', 'Cannot be targeted directly', 'An object covering the whole target'],
        ],
      },
      {
        type: 'p',
        text: '**Using the grid.** The map in this app uses squares:',
      },
      {
        type: 'list',
        items: [
          '**1 square = 5 feet.** Divide your Speed by 5 to get squares: Speed 30 = 6 squares.',
          'Moving diagonally costs the same as moving straight: 1 square. You cannot cut diagonally past a wall corner.',
          '**Difficult Terrain** (rubble, undergrowth, steep stairs, a non-ally\'s space) costs 2 squares per square.',
          'You can move through an ally\'s square but cannot end your move there. A non-ally\'s space usually blocks you unless it is much larger or smaller than you.',
          'Bigger creatures take more squares: Large is 2 by 2, Huge 3 by 3, Gargantuan 4 by 4.',
          'Making a ranged attack while an enemy who can see you is within 5 feet gives you Disadvantage.',
        ],
      },
    ],
  },

  {
    id: 'dice',
    title: 'Dice',
    kicker: 'Reading the rolls',
    summary:
      'D&D uses seven kinds of dice, written as d4 through d20 plus d100. Notation like 2d6+3 tells you exactly what to roll.',
    blocks: [
      {
        type: 'p',
        text: 'Dice are named by their number of sides: a **d6** is a normal six-sided die, a **d20** has twenty sides. Here is what each is usually for:',
      },
      {
        type: 'table',
        head: ['Die', 'Usually used for'],
        rows: [
          ['d4', 'Small weapons like a Dagger; small bonuses and effects'],
          ['d6', 'Shortswords and Shortbows, many spells, generating ability scores'],
          ['d8', 'Longswords, Rapiers, Longbows; Hit Point Die for many classes'],
          ['d10', 'Heavy weapons like a Glaive or Heavy Crossbow; Fighter, Paladin, and Ranger Hit Point Die'],
          ['d12', 'Greataxe damage; Barbarian Hit Point Die'],
          ['d20', 'Every D20 Test: ability checks, saving throws, attack rolls, Initiative'],
          ['d100 (percentile)', 'Random tables. Roll two d10s: one for tens, one for ones (00 and 0 means 100)'],
        ],
      },
      {
        type: 'p',
        text: '**Reading notation.** "XdY+Z" means roll X dice with Y sides, add them up, then add Z once. If there is no number in front, it is one die: "d20" means 1d20.',
      },
      {
        type: 'table',
        head: ['Notation', 'Meaning', 'Typical use'],
        rows: [
          ['1d20+5', 'Roll one d20, add 5', 'An attack roll or check with a +5 bonus'],
          ['2d6', 'Roll two d6, add them', 'Greatsword damage'],
          ['1d8+3', 'Roll one d8, add 3', 'Longsword hit with +3 Strength'],
          ['4d6kh3', 'Roll four d6, keep the highest three', 'Rolling one ability score'],
          ['2d20kh1', 'Roll two d20, keep the higher', 'A roll with **Advantage**'],
          ['2d20kl1', 'Roll two d20, keep the lower', 'A roll with **Disadvantage**'],
          ['1d100', 'Roll percentile dice', 'Rolling on a random table'],
        ],
      },
      {
        type: 'p',
        text: 'The modifier is added once, not per die: **2d6+3** is "roll two d6, total them, then add 3", not 3 per die.',
      },
      {
        type: 'callout',
        title: 'Rolling in this app',
        text: 'Click the **dice tray** to roll, or type **/roll 1d20+5** in chat with any notation above. Results show up in chat for the table. The DM can also make **private rolls** that only they see, for secret checks and hidden enemies.',
      },
    ],
  },

  {
    id: 'dm-vs-players',
    title: 'DM vs players',
    kicker: 'Who does what',
    summary:
      'The DM runs the world and the rules; each player runs one character. Here is how the work splits, plus tips for your first session in either seat.',
    blocks: [
      {
        type: 'p',
        text: '**The DM:**',
      },
      {
        type: 'list',
        items: [
          'Describes the world, the scene, and what the characters notice.',
          'Plays every non-player character (NPC) and monster.',
          'Decides when a roll is needed, which kind, and the DC.',
          'Interprets the rules and makes the call when they are unclear.',
          'Runs combat: places tokens, tracks Initiative, and takes the monsters\' turns.',
          'Prepares or improvises the adventure and keeps the pace up.',
          'Makes sure every player gets time in the spotlight.',
        ],
      },
      {
        type: 'p',
        text: '**Each player:**',
      },
      {
        type: 'list',
        items: [
          'Controls one character: what they say, do, want, and fear.',
          'Describes what the character is trying to do and how.',
          'Rolls when asked and adds the right numbers from the character sheet.',
          'Tracks their own character: HP, spells, items, and conditions.',
          'Works with the rest of the party, even when characters disagree.',
          'Asks questions about the world: "What does the room smell like?" is a fine question.',
        ],
      },
      {
        type: 'p',
        text: '**Tips for your first session as a player:**',
      },
      {
        type: 'list',
        items: [
          '**Say what your character does, not which rule applies.** "I run my hand along the statue looking for a hidden switch" beats "I roll Investigation." The DM picks the roll.',
          'Not sure what is possible? Ask the DM **"What would I need to roll?"**',
          'Keep your sheet open and know your HP, AC, and main attack. That covers most turns.',
          'Plan your next turn while others take theirs.',
          'Not knowing the rules is fine. The DM and other players will help, and you will pick it up fast.',
          'You do not need to do voices. Talking about your character in the third person is fine too.',
          'Failing a roll is not failing the game. It usually makes the story more interesting.',
        ],
      },
      {
        type: 'p',
        text: '**Tips for a first-time DM:**',
      },
      {
        type: 'list',
        items: [
          '**Rulings over rules.** If you do not know a rule, make a quick, fair call and look it up after the session.',
          '**Start small:** a one-shot, level 1 to 3 characters, and pre-made characters so nobody has to build one.',
          'Use a ready-made adventure and the creatures in the SRD instead of inventing everything.',
          'End your descriptions with **"What do you do?"** and then let the players drive.',
          'Only call for a roll when success is possible and failure is interesting. Otherwise, just say yes.',
          'Describe results, including misses: "The blade glances off its shield" is better than "You miss."',
          'Use private rolls for secret checks, and let players handle their own rolls and math.',
          'Share the load: ask a player to keep notes or remind you of the turn order.',
        ],
      },
    ],
  },

  {
    id: 'table-etiquette',
    title: 'Playing well together remotely',
    kicker: 'Table etiquette',
    summary:
      'A short session zero, a few safety tools, spotlight sharing, and good use of the ping tool and chat make remote games run smoothly.',
    blocks: [
      {
        type: 'p',
        text: '**Session zero.** Before the first real game, spend a short session agreeing on how you want to play. Cover:',
      },
      {
        type: 'list',
        items: [
          '**Tone:** lighthearted and silly, or serious and dramatic?',
          '**Mix:** how much combat versus talking and exploring.',
          '**Logistics:** schedule, session length, and what happens when someone cannot make it.',
          '**Characters:** rough concepts, and why the group is together.',
          '**Content boundaries:** see lines and veils below.',
        ],
      },
      {
        type: 'p',
        text: '**Lines and veils** are a simple safety tool. A **line** is something that will not appear in the game at all. A **veil** is something that can happen, but off-screen ("fade to black"). Collect these at session zero, privately if people prefer, and respect them without asking for reasons.',
      },
      {
        type: 'p',
        text: 'Also agree on a quick **pause signal** for mid-game, such as a word or symbol anyone can drop in chat to skip or rewind a scene. No explanation required.',
      },
      {
        type: 'p',
        text: '**Share the spotlight.**',
      },
      {
        type: 'list',
        items: [
          'Notice who has not done anything for a while and ask what their character is up to.',
          'Set up other characters\' moments: "Can your Rogue check the lock while I keep watch?"',
          'Let quieter players finish their thought. On a call, talking over someone is easy and frustrating.',
          'Keep side conversations and jokes in chat so the scene can continue.',
        ],
      },
      {
        type: 'p',
        text: '**Keep the game moving.**',
      },
      {
        type: 'list',
        items: [
          'Decide your combat turn before it comes around.',
          'Keep rules lookups short. Let the DM make a ruling and check it later.',
          'Start each session with a one-minute recap of last time.',
          'Mute when you are not talking, and use headphones to avoid echo.',
        ],
      },
      {
        type: 'p',
        text: '**Pointing at things on the map.** On a call, nobody can see where you are looking.',
      },
      {
        type: 'list',
        items: [
          'Use the **ping tool** to flash a spot on the map so everyone looks at the same place: "I want to move here" or "What is behind this door?"',
          'Ping a token and then say what you are doing: "I attack the guard I just pinged."',
          'Use **chat** for rolls, quick questions, and anything you do not want to say over the scene. The DM can reply there too.',
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Quick reference
// ---------------------------------------------------------------------------

export const quickReference: RefEntry[] = [
  // ----- Conditions -----
  {
    id: 'blinded',
    term: 'Blinded',
    category: 'Condition',
    summary: "You can't see, so you fight at a disadvantage and enemies find you easy to hit.",
    details: [
      "You can't see and automatically fail any ability check that requires sight.",
      'Attack rolls against you have Advantage.',
      'Your attack rolls have Disadvantage.',
    ],
    keywords: ['blind', 'sight', 'darkness', 'condition'],
  },
  {
    id: 'charmed',
    term: 'Charmed',
    category: 'Condition',
    summary: "You can't harm the creature that charmed you, and it has an easier time talking you into things.",
    details: [
      "You can't attack the charmer or target it with damaging abilities or magical effects.",
      'The charmer has Advantage on any ability check to interact with you socially.',
    ],
    keywords: ['charm', 'mind control', 'condition'],
  },
  {
    id: 'deafened',
    term: 'Deafened',
    category: 'Condition',
    summary: "You can't hear.",
    details: ["You can't hear and automatically fail any ability check that requires hearing."],
    keywords: ['deaf', 'hearing', 'condition'],
  },
  {
    id: 'exhaustion',
    term: 'Exhaustion',
    category: 'Condition',
    summary: 'A stacking condition with levels 1 to 6; each level makes your rolls worse and slows you down.',
    details: [
      'Each time you gain this condition, you gain 1 Exhaustion level. At level 6, you die.',
      'Your D20 Tests are reduced by 2 times your Exhaustion level (for example, -4 at level 2).',
      'Your Speed is reduced by 5 feet times your Exhaustion level.',
      'Finishing a Long Rest removes 1 level. At level 0, the condition ends.',
    ],
    keywords: ['exhausted', 'tired', 'fatigue', 'levels', 'condition'],
  },
  {
    id: 'frightened',
    term: 'Frightened',
    category: 'Condition',
    summary: "You're afraid of something and struggle to act while it's in view.",
    details: [
      'You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight.',
      "You can't willingly move closer to the source of your fear.",
    ],
    keywords: ['fear', 'scared', 'afraid', 'condition'],
  },
  {
    id: 'grappled',
    term: 'Grappled',
    category: 'Condition',
    summary: "Someone has hold of you, so you can't move away on your own.",
    details: [
      "Your Speed is 0 and can't increase.",
      'You have Disadvantage on attack rolls against any target other than the grappler.',
      'The grappler can drag or carry you when it moves (at extra movement cost unless you are much smaller).',
      'Escape with an action: a Strength (Athletics) or Dexterity (Acrobatics) check against the escape DC.',
    ],
    keywords: ['grab', 'grapple', 'held', 'condition'],
  },
  {
    id: 'incapacitated',
    term: 'Incapacitated',
    category: 'Condition',
    summary: "You can't do anything that takes an action, and you can't speak.",
    details: [
      "You can't take any action, Bonus Action, or Reaction.",
      'Your Concentration is broken.',
      "You can't speak.",
      'If you are Incapacitated when you roll Initiative, you have Disadvantage on the roll.',
    ],
    keywords: ['helpless', 'cant act', 'condition'],
  },
  {
    id: 'invisible',
    term: 'Invisible',
    category: 'Condition',
    summary: "Others can't see you, which makes you hard to hit and good at landing attacks.",
    details: [
      'If you are Invisible when you roll Initiative, you have Advantage on the roll.',
      "You aren't affected by effects that require the target to be seen, unless the creator can somehow see you. Your gear is concealed too.",
      'Attack rolls against you have Disadvantage, and your attack rolls have Advantage, except against creatures that can somehow see you.',
      'A successful Hide action gives you this condition while you stay hidden.',
    ],
    keywords: ['invisibility', 'unseen', 'hidden', 'condition'],
  },
  {
    id: 'paralyzed',
    term: 'Paralyzed',
    category: 'Condition',
    summary: "You're frozen in place and extremely vulnerable to close attacks.",
    details: [
      "You have the Incapacitated condition, and your Speed is 0 and can't increase.",
      'You automatically fail Strength and Dexterity saving throws.',
      'Attack rolls against you have Advantage.',
      'Any attack that hits you is a Critical Hit if the attacker is within 5 feet of you.',
    ],
    keywords: ['paralysis', 'frozen', 'held', 'auto crit', 'condition'],
  },
  {
    id: 'petrified',
    term: 'Petrified',
    category: 'Condition',
    summary: "You've been turned into a solid inanimate substance, usually stone.",
    details: [
      'You and your nonmagical gear become stone (or similar). Your weight increases tenfold and you stop aging.',
      "You have the Incapacitated condition, and your Speed is 0 and can't increase.",
      'Attack rolls against you have Advantage, and you automatically fail Strength and Dexterity saving throws.',
      'You have Resistance to all damage and Immunity to the Poisoned condition.',
    ],
    keywords: ['stone', 'statue', 'petrify', 'condition'],
  },
  {
    id: 'poisoned',
    term: 'Poisoned',
    category: 'Condition',
    summary: "You're sick and everything you try is harder.",
    details: ['You have Disadvantage on attack rolls and ability checks.'],
    keywords: ['poison', 'sick', 'condition'],
  },
  {
    id: 'prone',
    term: 'Prone',
    category: 'Condition',
    summary: "You're lying on the ground: easy to hit up close, hard to hit from afar.",
    details: [
      'Your only movement options are to crawl or to spend half your Speed (round down) to stand up, which ends the condition. At Speed 0 you cannot stand.',
      'You have Disadvantage on attack rolls.',
      'Attack rolls against you have Advantage if the attacker is within 5 feet; otherwise they have Disadvantage.',
      'You can drop Prone on your turn for free (no action or movement), unless your Speed is 0.',
    ],
    keywords: ['knocked down', 'lying', 'trip', 'condition'],
  },
  {
    id: 'restrained',
    term: 'Restrained',
    category: 'Condition',
    summary: "You're tied up, webbed, or otherwise pinned in place.",
    details: [
      "Your Speed is 0 and can't increase.",
      'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
      'You have Disadvantage on Dexterity saving throws.',
    ],
    keywords: ['restrain', 'bound', 'webbed', 'stuck', 'condition'],
  },
  {
    id: 'stunned',
    term: 'Stunned',
    category: 'Condition',
    summary: "You're reeling and can't act.",
    details: [
      'You have the Incapacitated condition.',
      'You automatically fail Strength and Dexterity saving throws.',
      'Attack rolls against you have Advantage.',
    ],
    keywords: ['stun', 'dazed', 'condition'],
  },
  {
    id: 'unconscious',
    term: 'Unconscious',
    category: 'Condition',
    summary: "You're out cold, unaware of your surroundings, and completely vulnerable.",
    details: [
      'You have the Incapacitated and Prone conditions and drop whatever you are holding. When this ends, you remain Prone.',
      "Your Speed is 0 and can't increase, and you're unaware of your surroundings.",
      'Attack rolls against you have Advantage, and you automatically fail Strength and Dexterity saving throws.',
      'Any attack that hits you is a Critical Hit if the attacker is within 5 feet of you.',
      'Characters at 0 HP have this condition until they regain Hit Points.',
    ],
    keywords: ['knocked out', 'ko', 'asleep', 'unconscious', '0 hp', 'condition'],
  },

  // ----- Core rules -----
  {
    id: 'advantage',
    term: 'Advantage',
    category: 'Rule',
    summary: 'Roll two d20s and use the higher result.',
    details: [
      'Comes from favorable circumstances, actions like Help, or features and spells.',
      'Multiple sources do not stack; you still roll just two d20s.',
      'Advantage and Disadvantage on the same roll cancel out, no matter how many of each.',
      'In dice notation: 2d20kh1 plus your modifier.',
    ],
    keywords: ['adv', 'roll twice', 'higher', '2d20kh1'],
  },
  {
    id: 'disadvantage',
    term: 'Disadvantage',
    category: 'Rule',
    summary: 'Roll two d20s and use the lower result.',
    details: [
      'Comes from unfavorable circumstances, conditions, or effects.',
      'Multiple sources do not stack; you still roll just two d20s.',
      'Advantage and Disadvantage on the same roll cancel out.',
      'In dice notation: 2d20kl1 plus your modifier.',
    ],
    keywords: ['disadv', 'dis', 'roll twice', 'lower', '2d20kl1'],
  },
  {
    id: 'd20-test',
    term: 'D20 Test',
    category: 'Rule',
    summary: 'The umbrella term for the three core rolls: ability checks, saving throws, and attack rolls.',
    details: [
      'Roll a d20, add the relevant ability modifier, your Proficiency Bonus if proficient, and any other bonuses or penalties.',
      'Meet or beat the target number (a DC or an AC) to succeed.',
      'Anything that affects "D20 Tests" affects all three kinds of roll.',
    ],
    keywords: ['d20', 'roll', 'check', 'test'],
  },
  {
    id: 'ability-check',
    term: 'Ability Check',
    category: 'Rule',
    summary: 'A D20 Test to see if you succeed at a task, like climbing, sneaking, or persuading.',
    details: [
      'Named for the ability used, often with a skill: "Dexterity (Stealth)".',
      'Add your Proficiency Bonus if you are proficient in the skill or tool.',
      'The DM sets the DC: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible.',
      'The DM calls for one only when failure is possible and interesting.',
    ],
    keywords: ['check', 'skill check', 'skill', 'roll'],
  },
  {
    id: 'saving-throw',
    term: 'Saving Throw',
    category: 'Rule',
    summary: 'A D20 Test to resist or avoid a threat such as a trap, poison, or spell.',
    details: [
      'Named for an ability: a Dexterity save to dodge, Constitution to endure, Wisdom to resist mental assault.',
      'Add your Proficiency Bonus if you are proficient in that kind of save (your class grants at least two).',
      'The DC comes from the effect, such as a spellcaster\'s spell save DC.',
      'You can choose to fail a save without rolling.',
    ],
    keywords: ['save', 'saves', 'st', 'resist'],
  },
  {
    id: 'attack-roll',
    term: 'Attack Roll',
    category: 'Rule',
    summary: 'A D20 Test to hit a target with a weapon, an Unarmed Strike, or a spell.',
    details: [
      'Melee weapons use Strength, ranged weapons use Dexterity, spells use your spellcasting ability.',
      'Add your Proficiency Bonus if you are proficient with the weapon, and always for spell attacks.',
      "You hit if the total equals or beats the target's Armor Class.",
      'A natural 20 always hits (a Critical Hit); a natural 1 always misses.',
    ],
    keywords: ['attack', 'to hit', 'hit', 'nat 20', 'nat 1'],
  },
  {
    id: 'difficulty-class',
    term: 'Difficulty Class (DC)',
    category: 'Rule',
    summary: 'The target number for an ability check or saving throw.',
    details: [
      'Very easy 5, Easy 10, Medium 15, Hard 20, Very hard 25, Nearly impossible 30.',
      'The DM sets DCs for checks; effects like spells set DCs for saves.',
      'Equal to or higher than the DC is a success.',
    ],
    keywords: ['dc', 'target number', 'difficulty'],
  },
  {
    id: 'proficiency-bonus',
    term: 'Proficiency Bonus',
    category: 'Rule',
    summary: "A bonus based on your level, added to rolls for things you're trained in.",
    details: [
      '+2 at levels 1-4, +3 at 5-8, +4 at 9-12, +5 at 13-16, +6 at 17-20.',
      'Applies to proficient skills, saving throws, weapons, and tools, plus spell attacks and spell save DCs.',
      'Never added more than once to the same roll.',
      'Expertise doubles it for certain skills.',
    ],
    keywords: ['pb', 'prof', 'proficient', 'proficiency'],
  },
  {
    id: 'armor-class',
    term: 'Armor Class (AC)',
    category: 'Rule',
    summary: 'How hard you are to hit; an attack hits if its roll equals or beats your AC.',
    details: [
      'Base AC without armor is 10 + your Dexterity modifier.',
      'Armor, shields, spells, and some class features change it.',
      'You use only one base AC calculation at a time.',
      'Cover adds +2 (half) or +5 (three-quarters).',
    ],
    keywords: ['ac', 'armor', 'defense'],
  },
  {
    id: 'hit-points',
    term: 'Hit Points (HP)',
    category: 'Rule',
    summary: 'How much damage you can take before you drop.',
    details: [
      'Damage reduces HP; healing restores it, never above your maximum and never below 0.',
      'Losing HP has no effect on what you can do until you reach 0.',
      'At half HP or less you are Bloodied, which some effects care about.',
      'At 0 HP a character falls Unconscious and starts making Death Saving Throws; most monsters just die.',
    ],
    keywords: ['hp', 'health', 'life', 'damage', 'healing', 'bloodied'],
  },
  {
    id: 'temporary-hit-points',
    term: 'Temporary Hit Points',
    category: 'Rule',
    summary: 'A buffer of extra HP that absorbs damage before your real Hit Points do.',
    details: [
      'Lose Temporary Hit Points first; leftover damage carries over to your HP.',
      "They don't stack: if you get more, choose to keep the old amount or take the new one.",
      "They aren't healing and can't be healed. They don't wake you up at 0 HP.",
      'They last until used up or until you finish a Long Rest.',
    ],
    keywords: ['temp hp', 'thp', 'buffer', 'shield'],
  },
  {
    id: 'heroic-inspiration',
    term: 'Heroic Inspiration',
    category: 'Rule',
    summary: 'A reward from the DM that lets you reroll any one die right after rolling it.',
    details: [
      'Spend it immediately after rolling a die to reroll that die; you must use the new roll.',
      'You can have only one at a time. If you would gain another, you can give it to another player character who lacks it.',
      'DMs typically award it for heroic, in-character, or entertaining play. Some features grant it too.',
      'With Advantage or Disadvantage, you reroll only one of the two d20s.',
    ],
    keywords: ['inspiration', 'reroll', 'insp'],
  },
  {
    id: 'concentration',
    term: 'Concentration',
    category: 'Rule',
    summary: 'Some spells and effects last only while you keep focus on them.',
    details: [
      'Starting another Concentration effect ends the current one.',
      'When you take damage, make a Constitution save to keep it: DC 10 or half the damage taken (round down), whichever is higher, up to DC 30.',
      'It ends if you become Incapacitated or die.',
      'You can end it at any time, no action required.',
    ],
    keywords: ['conc', 'concentrate', 'spell', 'con save'],
  },
  {
    id: 'resistance-vulnerability',
    term: 'Resistance & Vulnerability',
    category: 'Rule',
    summary: 'Resistance halves damage of a type; Vulnerability doubles it.',
    details: [
      'Resistance: damage of that type is halved (round down).',
      'Vulnerability: damage of that type is doubled.',
      'Multiple instances of the same one count only once.',
      'Order: apply other modifiers first, then Resistance, then Vulnerability.',
      "Immunity means you don't take that damage type or aren't affected by that condition.",
    ],
    keywords: ['resist', 'resistant', 'vulnerable', 'immune', 'immunity', 'damage type', 'half damage'],
  },
  {
    id: 'light',
    term: 'Bright Light, Dim Light & Darkness',
    category: 'Rule',
    summary: 'Light level determines how well you can see, and therefore how well you notice and fight.',
    details: [
      'Bright Light: normal vision. Daylight, torches, lanterns, and fires within their radius.',
      'Dim Light (shadows, twilight, a full moon) is Lightly Obscured: Disadvantage on Wisdom (Perception) checks that rely on sight.',
      'Darkness (night, unlit dungeons) is Heavily Obscured: you are effectively Blinded when trying to see into it.',
    ],
    keywords: ['light', 'dark', 'dim', 'shadows', 'obscured', 'vision', 'torch'],
  },
  {
    id: 'darkvision',
    term: 'Darkvision',
    category: 'Rule',
    summary: 'Lets you see in the dark within a set range.',
    details: [
      'Within range, you see Dim Light as if it were Bright Light, and Darkness as if it were Dim Light.',
      'In Darkness you see only shades of gray, not colors.',
      "Darkness still counts as Dim Light for you, so sight-based Perception checks there have Disadvantage.",
      'Many species have it; check your character sheet for the range.',
    ],
    keywords: ['dark vision', 'night vision', 'see in dark', 'senses'],
  },

  // ----- Combat -----
  {
    id: 'initiative',
    term: 'Initiative',
    category: 'Combat',
    summary: 'A Dexterity check at the start of combat that sets the turn order.',
    details: [
      'Everyone rolls; the DM rolls for monsters, usually once per group of identical monsters.',
      'Turns go from highest to lowest and the order stays the same each round.',
      'Ties: players decide among characters, the DM decides among monsters, and the DM decides between a character and a monster.',
    ],
    keywords: ['init', 'turn order', 'order', 'start combat'],
  },
  {
    id: 'surprise',
    term: 'Surprise',
    category: 'Combat',
    summary: 'If you are caught unaware when combat starts, you have Disadvantage on your Initiative roll.',
    details: [
      'Typical case: hidden enemies start the fight while you have no idea they are there.',
      'You still get your turn normally; there is no skipped round.',
      'Being Invisible when you roll Initiative gives Advantage; being Incapacitated gives Disadvantage.',
    ],
    keywords: ['surprised', 'ambush', 'initiative'],
  },
  {
    id: 'critical-hit',
    term: 'Critical Hit',
    category: 'Combat',
    summary: 'A natural 20 on an attack roll always hits and deals extra damage.',
    details: [
      'Roll all of the attack\'s damage dice twice and add them, then add modifiers once.',
      'Example: a Dagger crit deals 2d4 + modifier instead of 1d4 + modifier.',
      'Extra damage dice from features (like a Rogue\'s Sneak Attack) are also doubled.',
      'Hits within 5 feet against a Paralyzed or Unconscious target are automatically Critical Hits.',
    ],
    keywords: ['crit', 'nat 20', 'natural 20', 'critical', 'double damage'],
  },
  {
    id: 'death-saving-throws',
    term: 'Death Saving Throws',
    category: 'Combat',
    summary: 'At 0 HP, you roll each turn to see whether you stabilize or die.',
    details: [
      'At the start of each of your turns at 0 HP, roll a d20 with no modifiers: 10 or higher succeeds, otherwise you fail.',
      'Three successes: you are Stable. Three failures: you die. They need not be consecutive.',
      'Natural 20: regain 1 HP. Natural 1: two failures.',
      'Taking damage at 0 HP: one failure, or two from a Critical Hit. Damage equal to your HP maximum kills you outright.',
      'An ally can stabilize you with the Help action and a DC 10 Wisdom (Medicine) check. Any healing brings you back.',
    ],
    keywords: ['death save', 'dying', '0 hp', 'zero hp', 'stabilize', 'unconscious', 'nat 20', 'nat 1'],
  },
  {
    id: 'opportunity-attack',
    term: 'Opportunity Attack',
    category: 'Combat',
    summary: 'When an enemy you can see leaves your reach, you can use your Reaction to make one melee attack against it.',
    details: [
      'The attack happens right before the creature leaves your reach (usually 5 feet).',
      'It uses your Reaction, so you can make only one per round.',
      'The Disengage action prevents it. Teleporting or being moved by something else (like a Shove) does not provoke one.',
    ],
    keywords: ['oa', 'aoo', 'attack of opportunity', 'reaction', 'leaving reach'],
  },
  {
    id: 'cover',
    term: 'Cover',
    category: 'Combat',
    summary: 'Obstacles between you and an attacker make you harder to hit.',
    details: [
      'Half Cover: +2 to AC and Dexterity saving throws (a low wall, another creature).',
      'Three-Quarters Cover: +5 to AC and Dexterity saving throws (an arrow slit, a thick tree trunk).',
      "Total Cover: you can't be targeted directly.",
      'Only the best cover applies; degrees do not add together.',
    ],
    keywords: ['cover', 'half cover', 'three-quarters', 'total cover', 'ac bonus', 'behind wall'],
  },
  {
    id: 'grapple',
    term: 'Grapple',
    category: 'Combat',
    summary: 'Use an Unarmed Strike to grab a creature and give it the Grappled condition.',
    details: [
      'Use it in place of an attack (for example, as part of the Attack action). The target must be within 5 feet and no more than one size larger than you, and you need a free hand.',
      'The target makes a Strength or Dexterity save (its choice) against DC 8 + your Strength modifier + your Proficiency Bonus. On a failure, it is Grappled.',
      'The same DC is used for its escape attempts.',
      'You can release the target at any time, no action required.',
    ],
    keywords: ['grab', 'grapple', 'hold', 'unarmed strike', 'wrestle'],
  },
  {
    id: 'shove',
    term: 'Shove',
    category: 'Combat',
    summary: 'Use an Unarmed Strike to push a creature 5 feet away or knock it Prone.',
    details: [
      'Use it in place of an attack. The target must be within 5 feet and no more than one size larger than you.',
      'The target makes a Strength or Dexterity save (its choice) against DC 8 + your Strength modifier + your Proficiency Bonus.',
      'On a failure, you choose: push it 5 feet away or give it the Prone condition.',
      'Being pushed out of a creature\'s reach this way does not provoke an Opportunity Attack.',
    ],
    keywords: ['push', 'shove', 'knock prone', 'trip', 'unarmed strike'],
  },
  {
    id: 'speed-difficult-terrain',
    term: 'Speed & Difficult Terrain',
    category: 'Combat',
    summary: 'Speed is how far you can move on your turn; Difficult Terrain costs double.',
    details: [
      'Most characters have a Speed of 30 feet (6 squares). You can split movement around your action.',
      'In Difficult Terrain every foot costs 1 extra foot: 2 squares per square on the grid.',
      'Difficult Terrain includes rubble, heavy snow, undergrowth, shin-to-waist-deep water, steep slopes, and spaces of creatures that are not your allies.',
      'Climbing, swimming, and crawling also cost 1 extra foot per foot unless you have a matching special speed.',
    ],
    keywords: ['speed', 'move', 'movement', 'difficult terrain', 'squares', 'feet'],
  },

  // ----- Actions -----
  {
    id: 'action-attack',
    term: 'Attack',
    category: 'Action',
    summary: 'Make one attack with a weapon or an Unarmed Strike.',
    details: [
      'Some features, like Extra Attack, let you make more than one attack with this action, and you can move between them.',
      'You can equip or unequip one weapon as part of each attack.',
    ],
    keywords: ['attack', 'hit', 'swing', 'shoot'],
  },
  {
    id: 'action-dash',
    term: 'Dash',
    category: 'Action',
    summary: 'Gain extra movement this turn equal to your Speed.',
    details: [
      'With a Speed of 30 feet, you can move up to 60 feet this turn.',
      'Uses your current Speed after modifiers; if your Speed is halved, so is the bonus.',
    ],
    keywords: ['run', 'sprint', 'double move'],
  },
  {
    id: 'action-disengage',
    term: 'Disengage',
    category: 'Action',
    summary: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn.",
    details: ['Use it to retreat safely from enemies who are next to you.'],
    keywords: ['retreat', 'withdraw', 'escape', 'opportunity attack'],
  },
  {
    id: 'action-dodge',
    term: 'Dodge',
    category: 'Action',
    summary: 'Focus on defense until the start of your next turn.',
    details: [
      'Attack rolls against you have Disadvantage if you can see the attacker.',
      'You have Advantage on Dexterity saving throws.',
      'You lose these benefits if you become Incapacitated or your Speed is 0.',
    ],
    keywords: ['defend', 'defense', 'dodge'],
  },
  {
    id: 'action-help',
    term: 'Help',
    category: 'Action',
    summary: 'Assist an ally with a check or an attack, or give first aid.',
    details: [
      'Ability check: pick a skill or tool you are proficient in; an ally near enough to assist has Advantage on their next check with it, before the start of your next turn.',
      'Attack roll: distract an enemy within 5 feet of you; the next attack roll by one of your allies against it has Advantage, before the start of your next turn.',
      'First aid: stabilize a creature at 0 HP with a DC 10 Wisdom (Medicine) check.',
    ],
    keywords: ['assist', 'aid', 'advantage', 'first aid', 'stabilize'],
  },
  {
    id: 'action-hide',
    term: 'Hide',
    category: 'Action',
    summary: 'Make a DC 15 Dexterity (Stealth) check to become hidden.',
    details: [
      'You must be Heavily Obscured or behind Three-Quarters or Total Cover, and out of any enemy\'s line of sight.',
      'On a success you have the Invisible condition while hidden. Your check total becomes the DC for others to find you with Wisdom (Perception).',
      'You stop being hidden if you make a sound louder than a whisper, an enemy finds you, you make an attack roll, or you cast a spell with a Verbal component.',
    ],
    keywords: ['hide', 'stealth', 'sneak', 'hidden', 'invisible'],
  },
  {
    id: 'action-influence',
    term: 'Influence',
    category: 'Action',
    summary: 'Try to talk a creature into doing something.',
    details: [
      'Describe or roleplay your approach: deceiving, intimidating, amusing, or persuading.',
      'If the creature is willing or flatly unwilling, no roll is needed. If it is hesitant, make a check.',
      'Checks: Charisma (Deception, Intimidation, Performance, or Persuasion) or Wisdom (Animal Handling). Default DC is 15 or the creature\'s Intelligence score, whichever is higher.',
      'Friendly creatures give you Advantage; Hostile ones give you Disadvantage.',
    ],
    keywords: ['persuade', 'deceive', 'intimidate', 'talk', 'social', 'charisma'],
  },
  {
    id: 'action-magic',
    term: 'Magic',
    category: 'Action',
    summary: 'Cast a spell, use a magic item, or use a magical feature.',
    details: [
      'Covers spells with a casting time of an action and items or features that require a Magic action.',
      'For spells that take 1 minute or longer, you take the Magic action each turn and must maintain Concentration.',
    ],
    keywords: ['cast', 'spell', 'magic item', 'spellcasting'],
  },
  {
    id: 'action-ready',
    term: 'Ready',
    category: 'Action',
    summary: 'Prepare an action to take later, in response to a trigger you choose.',
    details: [
      'Pick a perceivable trigger ("if it steps next to me") and an action, or movement up to your Speed.',
      'When the trigger happens, you can use your Reaction to act, or ignore it.',
      'A readied spell is cast now and held with Concentration until the trigger or the start of your next turn.',
    ],
    keywords: ['ready', 'hold', 'delay', 'wait', 'trigger', 'reaction'],
  },
  {
    id: 'action-search',
    term: 'Search',
    category: 'Action',
    summary: "Make a Wisdom check to discern something that isn't obvious.",
    details: [
      "Insight: a creature's state of mind.",
      "Medicine: a creature's ailment or cause of death.",
      'Perception: a concealed creature or object.',
      'Survival: tracks or food.',
    ],
    keywords: ['search', 'look', 'perception', 'insight', 'find', 'wisdom'],
  },
  {
    id: 'action-study',
    term: 'Study',
    category: 'Action',
    summary: 'Make an Intelligence check to recall or work out an important piece of information.',
    details: [
      'Arcana: spells, magic items, planes, and certain creatures.',
      'History: past events, people, civilizations, and wars.',
      'Investigation: traps, ciphers, riddles, and gadgets.',
      'Nature: terrain, plants, weather, and beasts.',
      'Religion: deities, rites, holy symbols, cults, and undead.',
    ],
    keywords: ['study', 'recall', 'knowledge', 'investigate', 'intelligence', 'lore'],
  },
  {
    id: 'action-utilize',
    term: 'Utilize',
    category: 'Action',
    summary: 'Use a nonmagical object that requires an action.',
    details: [
      'You get one free object interaction per turn (open a door, draw a weapon); a second one, or anything needing real effort, takes this action.',
      'Examples: opening a stuck door or turning a crank to lower a drawbridge.',
    ],
    keywords: ['use', 'object', 'item', 'interact', 'lever'],
  },
  {
    id: 'bonus-action',
    term: 'Bonus Action',
    category: 'Action',
    summary: 'An extra, quick action you can take on your turn, but only when a feature or spell gives you one.',
    details: [
      "You don't have a Bonus Action by default; something must specifically say you can do X as a Bonus Action.",
      'Only one per turn, at a time of your choice unless the feature says otherwise.',
      'Anything that stops you from taking actions also stops Bonus Actions.',
    ],
    keywords: ['bonus', 'ba', 'extra action'],
  },
  {
    id: 'reaction',
    term: 'Reaction',
    category: 'Action',
    summary: 'An instant response to a trigger, usable on your turn or someone else\'s.',
    details: [
      'You get one; after using it, you can\'t take another until the start of your next turn.',
      'The most common Reaction is the Opportunity Attack. Readied actions and some spells and features also use it.',
      'A Reaction happens right after its trigger unless its description says otherwise.',
    ],
    keywords: ['reaction', 'react', 'interrupt', 'opportunity attack'],
  },

  // ----- Resting -----
  {
    id: 'short-rest',
    term: 'Short Rest',
    category: 'Resting',
    summary: 'A 1-hour break during which you can spend Hit Point Dice to heal.',
    details: [
      'You need at least 1 HP to start, and you can only do light activity like reading, talking, eating, or keeping watch.',
      'Spend Hit Point Dice: roll each and add your Constitution modifier to regain that many HP (minimum 1 per die).',
      'Some class features recharge on a Short Rest.',
      'Rolling Initiative, casting a spell other than a cantrip, or taking damage interrupts it, and you gain no benefit.',
    ],
    keywords: ['short rest', 'sr', 'rest', 'hit dice', 'heal'],
  },
  {
    id: 'long-rest',
    term: 'Long Rest',
    category: 'Resting',
    summary: 'At least 8 hours of downtime, mostly sleep, that restores you fully.',
    details: [
      'Sleep at least 6 hours, with no more than 2 hours of light activity. You need at least 1 HP to start.',
      'You regain all lost HP and all spent Hit Point Dice; reduced ability scores and HP maximum return to normal.',
      'Your Exhaustion level drops by 1, and features that recharge on a Long Rest recharge.',
      "You can't start another Long Rest until 16 hours after finishing one.",
      'Interrupted by Initiative, non-cantrip spells, damage, or an hour of exertion. If you rested at least 1 hour first, you still get Short Rest benefits.',
    ],
    keywords: ['long rest', 'lr', 'sleep', 'rest', 'recover', 'heal'],
  },

  // ----- Dice -----
  {
    id: 'dice-notation',
    term: 'Dice Notation (XdY+Z)',
    category: 'Dice',
    summary: 'XdY+Z means roll X dice with Y sides, add them together, then add Z.',
    details: [
      '1d20+5: roll one d20 and add 5. "d20" alone means 1d20.',
      '2d6: roll two six-sided dice and add them.',
      'The modifier is added once to the total, not to each die.',
      'd100 (percentile): roll two d10s, one for tens and one for ones.',
      'In this app, type /roll followed by the notation in chat, for example /roll 1d8+3.',
    ],
    keywords: ['notation', 'xdy', '1d20', '2d6', 'd100', 'percentile', 'roll', '/roll'],
  },
  {
    id: 'dice-keep',
    term: 'Keep Highest / Keep Lowest (kh, kl)',
    category: 'Dice',
    summary: 'kh and kl roll extra dice and keep only the highest or lowest ones.',
    details: [
      '4d6kh3: roll four d6 and keep the highest three, the classic way to roll an ability score.',
      '2d20kh1: roll two d20 and keep the higher, which is Advantage.',
      '2d20kl1: roll two d20 and keep the lower, which is Disadvantage.',
      'Add your modifier after: 2d20kh1+5.',
    ],
    keywords: ['kh', 'kl', 'keep highest', 'keep lowest', '4d6kh3', '2d20kh1', '2d20kl1', 'advantage', 'disadvantage'],
  },
]

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const resources: Resource[] = [
  {
    title: 'D&D Free Rules (2024)',
    url: 'https://www.dndbeyond.com/sources/dnd/free-rules',
    description: 'The official free basic rules for the 2024 edition: playing the game, character creation, classes, spells, and more.',
    kind: 'Official',
  },
  {
    title: 'Rules Glossary (Free Rules)',
    url: 'https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary',
    description: 'Official definitions of every condition, action, and rules term. Handy for looking things up mid-game.',
    kind: 'Official',
  },
  {
    title: 'System Reference Document 5.2.1',
    url: 'https://www.dndbeyond.com/srd',
    description: 'The Creative Commons licensed rules reference this guide is based on, with PDF downloads.',
    kind: 'Official',
  },
  {
    title: 'How to Play D&D',
    url: 'https://www.dndbeyond.com/en/how-to-play-dnd',
    description: "The official new player page: what D&D is, how a game works, and where to start. (dnd.wizards.com/how-to-play redirects here.)",
    kind: 'Guide',
  },
  {
    title: 'How to Play Dungeons & Dragons (video)',
    url: 'https://www.youtube.com/watch?v=ZsPrUwcjxEw',
    description: 'A short official introduction video from the Dungeons & Dragons channel.',
    kind: 'Guide',
  },
  {
    title: 'How to Be a Dungeon Master',
    url: 'https://www.dndbeyond.com/posts/1452-how-to-be-a-dungeon-master',
    description: 'Official D&D Beyond article with tips for running your first session.',
    kind: 'Guide',
  },
  {
    title: 'Premade Characters and Campaigns',
    url: 'https://www.dndbeyond.com/posts/1479-jump-into-adventures-with-premade-characters-and',
    description: 'Official D&D Beyond article on jumping in with ready-to-play characters.',
    kind: 'Guide',
  },
  {
    title: 'D&D Beyond Character Builder',
    url: 'https://www.dndbeyond.com/characters/builder',
    description: 'A free, guided character builder with a digital character sheet. Requires a free account.',
    kind: 'Tool',
  },
  {
    title: 'Creative Commons Attribution 4.0 (CC BY 4.0)',
    url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    description: 'The license the SRD 5.2.1 is released under.',
    kind: 'License',
  },
]
