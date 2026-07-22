import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, profiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { ProfileSchema } from '@/lib/validations'
import { calcInitialTdee } from '@/lib/tdee'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.userId, session.user.id)))
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(profile)
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, sex, age, heightCm, weightKg, activityLevel, tdeeWindowDays } = parsed.data
  const initialTdee = calcInitialTdee({ sex, age, heightCm, weightKg, activityLevel })

  const [updated] = await db.update(profiles)
    .set({ name, sex, age, heightCm: String(heightCm), weightKg: String(weightKg), activityLevel, initialTdee: String(initialTdee), tdeeWindowDays })
    .where(and(eq(profiles.id, id), eq(profiles.userId, session.user.id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  await db.delete(profiles).where(and(eq(profiles.id, id), eq(profiles.userId, session.user.id)))
  return new NextResponse(null, { status: 204 })
}
