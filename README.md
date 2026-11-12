# Hearthlight

Hearthlight is a browser-based virtual tabletop for playing Dungeons & Dragons with a small group, such as an engineering team playing remotely. A Dungeon Master (DM) creates a campaign and shares an invite link. Up to 10 players join with a display name and avatar, with no accounts. Everyone shares a real-time battle map, chat and dice.

## Features

- **Sessions**: the DM creates a campaign and gets a shareable invite link. Players join without registering. Presence shows who is connected. The DM can start, pause, resume and end sessions, make save points, and remove players or pause their movement or chat.
- **Battle map**: square grid with pan, zoom and pinch. Maps can be uploaded images or blank grids. Player, monster and NPC tokens show names and HP bars. Dragging a token shows a live preview to everyone else. There is a ping tool, DM-controlled fog of war (brush or box), and multiple scenes. The DM can prepare a scene privately before showing it to players.
- **Chat and dice**: persistent chat with timestamps. Dice rolls are server-authoritative (`1d20+5`, `2d6`, `4d6kh3`, `1d20 adv`). There is a one-click dice tray, a roll history filter, and DM-only private rolls (`/pr 1d20`). Each player's character sheet has one-click roll buttons.
- **DM dashboard**: party management (HP, max HP, AC, conditions, private notes), an encounter tool with SRD monster presets, an initiative tracker with turn order and a "Next turn" control, scene and fog controls, private session notes, and save points.
- **Maps from real places**: the DM names any place on Earth, plus optional story points such as villains, tone or party level. An AI agent finds the place on Google Maps, studies the satellite view, paints a top-down fantasy battle map from it and writes a private story brief. The brief covers the premise, a read-aloud intro, keyed locations, NPCs, hooks, secrets and SRD encounters that can be placed on the map with one click. The result arrives as a new hidden scene. If Google Maps is unavailable, the agent works from its own knowledge of the place and says so in the brief.
- **Learn D&D**: a beginner's guide and a searchable quick-rules reference based on the SRD 5.2.1. The reference is also available in-game as a slide-over drawer. The Learn section links to the official free rules and the D&D Beyond character builder.
- **Demo adventure**: "The Ruined Watchtower" has an original map, four pre-made level 1 characters, goblins and skeletons, a read-aloud intro and a step-by-step encounter guide.

## Tech stack

- **Frontend**: React 19 + Vite (static SPA in `dist/`), React Router, lucide-react icons, hand-written CSS.
- **Backend**: one **Netlify Server** (`netlify/server/index.ts`, a long-running Node.js process). It serves the JSON API under `/api/*` and a WebSocket endpoint at `/ws`, using the `ws` library.
- **Storage**: **Netlify Database** (Postgres) via Drizzle ORM holds campaigns, participants, chat, sessions and save points. **Netlify Blobs** holds map images.
- **Images**: Netlify Image CDN serves the landing page art.
- **Map agent**: a Netlify background function (`netlify/functions/map-agent-background.mts`) runs a Claude tool-use loop (`server/mapAgent.ts`) through Netlify AI Gateway. Its tools call the Google Maps Platform (Places API (New), with Geocoding as a fallback, and the Maps Static API) and a Gemini image model that paints the map. It needs `GOOGLE_MAPS_API_KEY`: a server-side key (no HTTP-referrer restriction) with those three APIs enabled.

See `AGENTS.md` for the architecture in detail.

## Running locally

Requirements: Node.js 24+ and the Netlify CLI.

```bash
npm install
netlify dev --port 8889
```

Then open http://localhost:8889. `netlify dev` starts Vite on port 5173, the Netlify Server and a local development database.

The first time you run it, apply the migrations to the local development database:

```bash
netlify database migrations apply
```

If your shell has `NETLIFY_DB_URL` set (for example, pointing at a remote branch), unset it for local development so the CLI uses its local database.

### Testing multiplayer

With the dev server running:

```bash
npm run test:multiplayer
```

This connects a DM and several players over WebSockets. It checks token sync, concurrent moves, permissions, chat and dice, private rolls, fog and hidden-monster filtering, masked map delivery, reconnects, persistence and kicking a player.

To try it by hand, open the demo in one browser and the invite link in a private window.

## Schema changes

The schema lives in `db/schema.ts`. After changing it, generate a migration:

```bash
npx drizzle-kit generate --name describe_the_change
```

Netlify applies migrations automatically on deploy.

## Licensing

Rules content in the Learn section and the monster statistics come from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. The Ruined Watchtower adventure, its characters and its map are original. Hearthlight is an unofficial fan tool and is not affiliated with Wizards of the Coast.
