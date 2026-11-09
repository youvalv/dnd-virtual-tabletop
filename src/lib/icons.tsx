import {
  Axe, Bird, Bone, BookOpen, BowArrow, Bug, Cat, Crown, Feather, Flame, Gem, Ghost, Hammer, Leaf, Moon, Mountain,
  Music, PawPrint, Shield, Skull, Sword, Swords, User, WandSparkles, type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  sword: Sword, shield: Shield, 'wand-sparkles': WandSparkles, 'bow-arrow': BowArrow, hammer: Hammer, axe: Axe,
  feather: Feather, flame: Flame, leaf: Leaf, moon: Moon, music: Music, 'book-open': BookOpen, gem: Gem, crown: Crown,
  cat: Cat, bird: Bird, skull: Skull, bone: Bone, ghost: Ghost, 'paw-print': PawPrint, swords: Swords, bug: Bug,
  mountain: Mountain, user: User,
}

export const TOKEN_ICON_CHOICES = ['skull', 'bone', 'ghost', 'paw-print', 'swords', 'bug', 'mountain', 'crown', 'flame', 'gem', 'user', 'shield']

export function Icon({ name, size = 18, ...rest }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const C = ICONS[name] ?? User
  return <C size={size} {...rest} />
}

export function Avatar({ icon, color, size = 30, online }: { icon: string; color: string; size?: number; online?: boolean }) {
  return (
    <span className="av" style={{ background: color, width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.55)} strokeWidth={2.2} />
      {online !== undefined && <span className={`dot badge ${online ? 'on' : ''}`} />}
    </span>
  )
}

export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  // A lantern-lit d20 silhouette.
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0a35c" />
          <stop offset="1" stopColor="#b8632a" />
        </linearGradient>
      </defs>
      <path d="M16 2 28 9v14l-12 7L4 23V9z" fill="url(#bm)" />
      <path d="M16 2 28 9 16 12 4 9zM16 12v18M4 9l12 3 12-3M4 23l12-11 12 11" fill="none" stroke="#2a1a0e" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M16 2 28 9v14l-12 7L4 23V9z" fill="none" stroke="#2a1a0e" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
