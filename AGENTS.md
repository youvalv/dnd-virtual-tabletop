# AGENTS.md

Guidance for AI agents working on Hearthlight, a multiplayer D&D virtual tabletop on Netlify.

## Architecture

```
Browser (React SPA, dist/)  ──HTTP /api/*──▶  Netlify Server (netlify/server/index.ts)
            │                                      │  server/http.ts   REST: create/join/upload/map images
            └────WebSocket /ws──────────────────▶  │  server/ops.ts    every game action, permission checks
                                                   │  server/hub.ts    rooms, per-viewer push, cross-instance sync
                                                   │  server/views.ts  per-viewer filtering (security boundary)
                                                   ├──▶ Netlify Database (Postgres, Drizzle): db/schema.ts
                                                   └──▶ Netlify Blobs store "maps": map images

Netlify Server ──POST (HMAC-signed)──▶ netlify/functions/map-agent-background.mts ──▶ server/mapAgent.ts
                                         Claude tool loop (AI Gateway) + Google Maps Platform + Gemini image model
                                         writes board.mapJobs / new scene + brief to the DB; instances sync via NOTIFY/polling
```

- **The server is authoritative.** Clients send intents (`ClientOp` in `shared/types.ts`) over the WebSocket. The server validates input and permissions in `server/ops.ts`, persists the change, and pushes each connected client its own filtered view.
- **Realtime transport**: WebSockets (`ws` attached to the exported `http.Server`). Verified working on the Netlify Server, including under `netlify dev`. Clients reconnect with exponential backoff (`src/lib/game.ts`). Every connection starts with a full `welcome` snapshot, so reconnects and refreshes never lose state.
- **Persistence**:
  - Each campaign row stores the tabletop (scenes, tokens, fog, characters, initiative, DM notes and the guide) as one JSONB `board` document.
  - Every mutation runs in `mutateCampaign` (`server/store.ts`): a transaction with `SELECT ... FOR UPDATE`, a `version` optimistic check with retry, and a per-campaign in-process queue.
  - Chat, participants, game sessions and save points are normal tables.
- **Multiple server instances**: Netlify may run several instances, each with its own sockets. After a change, the instance sends `pg_notify('vtt_sync', ...)`. Instances `LISTEN` and also poll `campaigns.version` and the latest message id every 2.5 s as a fallback, so a missed notification only delays an update. Pings and drag previews travel only via NOTIFY (they are best-effort).
- **Identity**: there are no accounts. Creating or joining returns a random secret. The server stores only its SHA-256 hash in `participants.token_hash`, and the client keeps the secret in localStorage (`src/lib/api.ts`). The DM can move to another device with `/table/:id#dmkey=...`.

## Map agent (real place to battle map)

- The DM posts `{ place, story, fog }` to `/api/campaigns/:id/map-agent`. The server records a `MapJob` in `board.mapJobs` (one active job per campaign; stale after 16 minutes) and starts the background function with `mapJobSignature` (HMAC with the campaign's `mapSecret`). The function moves the job from `queued` to `running` exactly once, so replayed requests do nothing.
- The agent (`claude-opus-5-5`, adaptive thinking) uses the tools `find_place`, `nearby_places`, `view_map`, `paint_battle_map` and `submit_brief`. Encounter monsters are restricted to `MONSTER_PRESETS` keys through a strict tool schema, which keeps the content within the SRD.
- Google failures are reported to the agent as tool errors. The agent then paints without a reference (`source: 'ai-only'`), and the brief's `notice` tells the DM why.
- The output is a new scene with the painted map stored at `maps/<campaign>/<scene>/full/1` and `scene.brief`. It also adds a DM-only chat message.

## Hidden information (security boundary)

`server/views.ts` is the only path from board state to a client. Players never receive:

- tokens with `hidden: true`
- non-PC tokens whose squares are all fogged
- monster exact HP or AC (they get a coarse `health` 0-4 instead)
- `dmNotes`, `sessionNotes`, `guide`, scene `brief` or `mapJobs`
- other scenes
- the invite code
- DM-only rolls (`messages.dm_only`)

Drag previews are filtered with the same visibility function.

**Map images and fog**: players must not be able to download the unfogged image.

- The DM's browser renders a masked copy with unrevealed squares painted over (`src/table/playerMap.ts`) and uploads it to `/api/campaigns/:id/scenes/:sid/player-map?fogRev=N`.
- Players only get signed URLs for that masked copy. They get the original only when fog is off on the active scene.
- `hideRev` records the last fog change that hid squares. A masked image older than `hideRev` is withdrawn, because it could reveal re-hidden squares.
- Map URLs are HMAC-signed with a per-campaign secret. The server re-checks access against the current state on every request (`serveMap` in `server/http.ts`).
- The demo map lives in `server/demo-map.ts` as base64 on purpose. Do **not** move it to `public/`, or players could fetch it directly.

When adding a field to `Board`, `Token`, `Character` or `Scene`, decide whether players may see it and update `views.ts`. `scripts/multiplayer-test.mjs` asserts the leak checks.

## Key directories

- `netlify/functions/map-agent-background.mts`: background function that runs the map agent. It is the only Netlify Function in the project.
- `netlify/server/index.ts`: server entry. It handles WebSocket connection lifecycle and presence. Its config exports `path: ['/api/*', '/ws']`. It must remain the only file in `netlify/server/`.
- `server/`: backend modules (http, ops, hub, views, store, content/demo, util, demo-map).
- `shared/`: types, the dice parser and roller, and presets (conditions, avatars, SRD monster presets). The client and server both use them.
- `db/`: Drizzle schema and client. Migrations live in `netlify/database/migrations/`; generate them with drizzle-kit and never hand-edit applied ones.
- `src/pages/`: Home, Join, Learn and Table (the game screen).
- `src/table/`: MapView (SVG map, pan/zoom, drag, fog brush, pings), DmPanel, PlayerPanel, Chat and DiceTray, TokenCard, Initiative and playerMap.
- `src/learn/content.ts`: SRD 5.2.1-based learning content and quick reference. Keep the CC BY 4.0 attribution (`SRD_ATTRIBUTION`) visible wherever rules text is shown.

## Conventions

- Server-side TypeScript runs under Node's type stripping in local dev. Use **explicit `.ts` extensions** in relative imports and `import type` for type-only imports. Avoid TS-only runtime syntax (enums, parameter properties, namespaces) in `server/`, `shared/` and `db/`.
- Validate and clamp every client value on the server (`clampInt`, `cleanText`, `cleanColor`, `cleanIcon`). Throw `OpError` for user-facing errors and `NoChange` to skip a write.
- Push state with `applyLocalChange(room, row)` after a mutation. `pushState` only sends to clients whose filtered view changed.
- UI: dark warm palette and CSS variables in `src/styles.css`. Grenze is the display font and Alegreya Sans the body font. Keep the player UI simpler than the DM UI, and keep animations minimal.
- Rules content must stay within the SRD 5.2.1. Do not add non-SRD monsters, spells or setting names.

## Non-obvious local dev notes

- The Netlify Server needs Node 24+.
- `netlify dev` currently sends **every** non-static path to the Netlify Server and ignores `config.path`. `server/http.ts` therefore forwards non-`/api` GETs to Vite (port 5173), but only when `NETLIFY_DEV`/`CONTEXT=dev` is set. In production only `/api/*` and `/ws` reach the server, and `dist/` plus SPA rewrites in `netlify.toml` serve the pages.
- The dev server does not hot-reload modules imported by the server entry. Restart `netlify dev` after editing `server/*`.
- The local dev database is an emulator that shares one session across connections. A failing query there can abort a concurrent transaction, so keep queries correct, and the optimistic version check protects against lost updates either way.
- With `NETLIFY_DB_URL` set in the environment, the CLI targets that remote database. Unset it to use the local one, and never apply migrations to remote branches by hand.
