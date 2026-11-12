// Background function (runs up to 15 minutes): builds a battle map and story
// brief from a real place. Started by POST /api/campaigns/:id/map-agent on the
// Netlify Server; the request is HMAC-signed with the campaign's secret.
import { runMapJob } from '../../server/mapAgent.ts'

export default async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  await runMapJob(String(body.campaignId ?? ''), String(body.jobId ?? ''), String(body.sig ?? ''))
}
