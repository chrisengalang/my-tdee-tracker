import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, dailyLogs, profiles } from '@/lib/db'
import { eq, and, gte } from 'drizzle-orm'
import { DailyLogSchema } from '@/lib/validations'
import { calcAdaptiveTdee } from '@/lib/tdee'

type Params = { params: Promise<{ id: string }> }

async function recalcAdaptiveTdee(profileId: string, windowDays: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const logs = await db.select({
    caloriesKcal: dailyLogs.caloriesKcal,
    weightKg: dailyLogs.weightKg,
    logDate: dailyLogs.logDate,
  }).from(dailyLogs)
    .where(and(eq(dailyLogs.profileId, profileId), gte(dailyLogs.logDate, cutoffStr)))

  const mapped = logs.map(l => ({
    caloriesKcal: Number(l.caloriesKcal),
    weightKg: l.weightKg ? Number(l.weightKg) : null,
    logDate: l.logDate,
  }))

  const adaptive = calcAdaptiveTdee(mapped)
  if (adaptive !== null) {
    await db.update(profiles)
      .set({ adaptiveTdee: String(adaptive) })
      .where(eq(profiles.id, profileId))
  }
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const parsed = DailyLogSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { profileId, logDate, caloriesKcal, weightKg, notes } = parsed.data

  // Verify profile belongs to user
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, session.user.id)))
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [updated] = await db.update(dailyLogs)
    .set({ logDate, caloriesKcal: String(caloriesKcal), weightKg: weightKg != null ? String(weightKg) : null, notes })
    .where(eq(dailyLogs.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await recalcAdaptiveTdee(profileId, profile.tdeeWindowDays)

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, id))
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify profile belongs to user
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, log.profileId), eq(profiles.userId, session.user.id)))
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(dailyLogs).where(eq(dailyLogs.id, id))
  await recalcAdaptiveTdee(log.profileId, profile.tdeeWindowDays)

  return new NextResponse(null, { status: 204 })
}
