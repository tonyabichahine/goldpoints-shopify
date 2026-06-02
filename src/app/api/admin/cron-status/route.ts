import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.CRONJOB_ORG_API_KEY
  const jobId = process.env.CRONJOB_JOB_ID
  if (!apiKey || !jobId) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  try {
    const [jobRes, historyRes] = await Promise.all([
      fetch(`https://api.cron-job.org/jobs/${jobId}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
      fetch(`https://api.cron-job.org/jobs/${jobId}/history`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    ])
    const { jobDetails } = await jobRes.json()
    const { history } = await historyRes.json()

    const lastRun = history?.[0]
    return NextResponse.json({
      enabled: jobDetails?.enabled ?? true,
      nextExecution: jobDetails?.nextExecution ?? 0,
      lastExecution: jobDetails?.lastExecution ?? 0,
      lastStatus: lastRun?.status ?? 0,
      lastDuration: lastRun?.duration ?? 0,
      lastHttpStatus: lastRun?.httpStatus ?? 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
