import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, profiles } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { ProfileSchema } from '@/lib/validations'
import { calcInitialTdee } from '@/lib/tdee'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(profiles).where(eq(profiles.userId, session.user.id))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, sex, age, heightCm, weightKg, activityLevel, tdeeWindowDays } = parsed.data
  const initialTdee = calcInitialTdee({ sex, age, heightCm, weightKg, activityLevel })

  const [profile] = await db.insert(profiles).values({
    userId: session.user.id,
    name, sex, age,
    heightCm: String(heightCm),
    weightKg: String(weightKg),
    activityLevel,
    initialTdee: String(initialTdee),
    tdeeWindowDays,
  }).returning()

  return NextResponse.json(profile, { status: 201 })
}
