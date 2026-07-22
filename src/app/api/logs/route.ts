import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, profiles, dailyLogs } from '@/lib/db'
import { eq, and, gte, desc } from 'drizzle-orm'
import { DailyLogSchema } from '@/lib/validations'
import { calcAdaptiveTdee } from '@/lib/tdee'

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

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  // Verify profile belongs to user
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, session.user.id)))
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const logs = await db.select().from(dailyLogs)
    .where(eq(dailyLogs.profileId, profileId))
    .orderBy(desc(dailyLogs.logDate))

  return NextResponse.json(logs)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = DailyLogSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { profileId, logDate, caloriesKcal, weightKg, notes } = parsed.data

  // Verify profile belongs to user
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, session.user.id)))
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [log] = await db.insert(dailyLogs).values({
    profileId, logDate,
    caloriesKcal: String(caloriesKcal),
    weightKg: weightKg != null ? String(weightKg) : null,
    notes,
  }).returning()

  // Trigger adaptive TDEE recalculation
  await recalcAdaptiveTdee(profileId, profile.tdeeWindowDays)

  return NextResponse.json(log, { status: 201 })
}
