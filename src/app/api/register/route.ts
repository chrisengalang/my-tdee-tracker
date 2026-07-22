// src/app/api/register/route.ts
import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { RegisterSchema } from '@/lib/validations'

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, name } = parsed.data
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning({ id: users.id })

  return NextResponse.json({ id: user.id }, { status: 201 })
}
