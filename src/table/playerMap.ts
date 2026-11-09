// The DM's browser renders the map with every unrevealed square painted over
// and uploads that copy for players. The server only ever serves players this
// masked image, so hidden parts of the map never reach their browsers.
import type { SceneView } from '../../shared/types.ts'

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(url: string) {
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('map image failed to load'))
      img.src = url
    })
    imageCache.set(url, p)
    if (imageCache.size > 6) imageCache.delete(imageCache.keys().next().value!)
  }
  return p
}

export async function renderPlayerMap(campaignId: string, token: string, scene: SceneView): Promise<'ok' | 'stale' | 'skip'> {
  if (scene.bg.kind !== 'image' || !scene.mapUrl || !scene.fogEnabled) return 'skip'
  const img = await loadImage(scene.mapUrl)
  const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const cw = w / scene.cols
  const ch = h / scene.rows
  ctx.fillStyle = '#0d0a08'
  for (let y = 0; y < scene.rows; y++)
    for (let x = 0; x < scene.cols; x++)
      if (scene.revealed[y * scene.cols + x] !== '1') {
        // Overdraw by a pixel so no sliver of a hidden square survives scaling.
        ctx.fillRect(Math.floor(x * cw) - 1, Math.floor(y * ch) - 1, Math.ceil(cw) + 2, Math.ceil(ch) + 2)
      }
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.8))
  const body = blob ?? (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png')))
  if (!body) return 'skip'
  const r = await fetch(`/api/campaigns/${campaignId}/scenes/${scene.id}/player-map?fogRev=${scene.fogRev}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': body.type },
    body,
  })
  if (r.status === 409) return 'stale'
  if (!r.ok) throw new Error('upload failed')
  return 'ok'
}
