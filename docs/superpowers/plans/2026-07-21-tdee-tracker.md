# TDEE Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Next.js 15 web app deployed on Vercel that tracks TDEE for multiple profiles under a single login, logs daily calories/weight, and auto-recalculates adaptive TDEE on every save.

**Architecture:** Next.js 15 App Router with React Server Components for data fetching, Route Handler API endpoints for mutations, Drizzle ORM talking to Vercel Postgres. A pure-TypeScript TDEE engine handles all formula logic. NextAuth.js v5 handles auth. Single account → many profiles → many daily logs.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Vercel Postgres (Neon), Drizzle ORM, NextAuth.js v5, Zod, Recharts, TypeScript

---

## File Map

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Drizzle schema — users, profiles, daily_logs |
| `src/lib/db/index.ts` | Vercel Postgres connection via Drizzle |
| `src/lib/tdee.ts` | Mifflin-St Jeor + adaptive TDEE pure functions |
| `src/lib/auth.ts` | NextAuth.js v5 config |
| `src/lib/validations.ts` | Zod schemas for all inputs |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `src/app/api/profiles/route.ts` | GET list + POST create profile |
| `src/app/api/profiles/[id]/route.ts` | GET + PUT + DELETE single profile |
| `src/app/api/logs/route.ts` | GET list + POST create log |
| `src/app/api/logs/[id]/route.ts` | PUT + DELETE single log |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/register/page.tsx` | Register page |
| `src/app/dashboard/page.tsx` | Dashboard (server component) |
| `src/app/profiles/new/page.tsx` | Create profile form |
| `src/app/profiles/[id]/page.tsx` | Profile detail + history |
| `src/app/log/page.tsx` | Daily log entry page |
| `src/components/ProfileSwitcher.tsx` | Profile chip tabs |
| `src/components/DailyLogForm.tsx` | Calorie + weight form |
| `src/components/TDEECard.tsx` | TDEE display card |
| `src/components/CalorieProgressBar.tsx` | Today's intake progress |
| `src/components/WeightChart.tsx` | Recharts weight trend |
| `src/components/CalorieChart.tsx` | Recharts calories vs TDEE |
| `src/components/LogHistoryTable.tsx` | Scrollable log table |
| `drizzle.config.ts` | Drizzle Kit config |
| `next.config.ts` | Next.js config |
| `.env.local` | Local env vars (not committed) |
| `.env.example` | Env var template (committed) |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Initialise the Next.js project**

```bash
cd C:/ws/my-tracking-project
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```

When prompted: answer **Yes** to TypeScript, Tailwind, App Router, src/ dir. Answer **No** to ESLint (we'll add later).

- [ ] **Step 2: Install dependencies**

```bash
npm install drizzle-orm @vercel/postgres
npm install next-auth@beta
npm install zod
npm install recharts
npm install drizzle-kit --save-dev
npm install @types/bcryptjs bcryptjs
```

- [ ] **Step 3: Create `.env.example`**

```bash
# .env.example
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Create `.env.local`** (fill in your actual Vercel Postgres values after DB is provisioned)

```bash
cp .env.example .env.local
```

- [ ] **Step 5: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING!,
  },
})
```

- [ ] **Step 6: Update `.gitignore`** — ensure these are present:

```
.env.local
.env*.local
drizzle/
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 15 project with Tailwind, Drizzle, NextAuth"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`

- [ ] **Step 1: Write the schema**

```typescript
// src/lib/db/schema.ts
import { pgTable, uuid, text, timestamp, numeric, integer, pgEnum, date, unique } from 'drizzle-orm/pg-core'

export const sexEnum = pgEnum('sex', ['male', 'female'])
export const activityEnum = pgEnum('activity_level', [
  'sedentary', 'light', 'moderate', 'active', 'very_active'
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sex: sexEnum('sex').notNull(),
  age: integer('age').notNull(),
  heightCm: numeric('height_cm', { precision: 5, scale: 1 }).notNull(),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }).notNull(),
  activityLevel: activityEnum('activity_level').notNull(),
  initialTdee: numeric('initial_tdee', { precision: 7, scale: 2 }).notNull(),
  adaptiveTdee: numeric('adaptive_tdee', { precision: 7, scale: 2 }),
  tdeeWindowDays: integer('tdee_window_days').notNull().default(28),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  caloriesKcal: numeric('calories_kcal', { precision: 7, scale: 1 }).notNull(),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueProfileDate: unique().on(t.profileId, t.logDate),
}))

export type User = typeof users.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type DailyLog = typeof dailyLogs.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type NewDailyLog = typeof dailyLogs.$inferInsert
```

- [ ] **Step 2: Write the DB connection**

```typescript
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql } from '@vercel/postgres'
import * as schema from './schema'

export const db = drizzle(sql, { schema })
export * from './schema'
```

- [ ] **Step 3: Verify schema compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add Drizzle schema — users, profiles, daily_logs"
```

---

## Task 3: TDEE Engine (Pure Functions)

**Files:**
- Create: `src/lib/tdee.ts`
- Create: `src/lib/tdee.test.ts`

- [ ] **Step 1: Install test runner**

```bash
npm install vitest @vitejs/plugin-react --save-dev
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests first**

```typescript
// src/lib/tdee.test.ts
import { describe, it, expect } from 'vitest'
import { calcInitialTdee, calcAdaptiveTdee, ACTIVITY_MULTIPLIERS } from './tdee'

describe('calcInitialTdee', () => {
  it('calculates male BMR correctly', () => {
    // Male, 30yo, 175cm, 80kg, moderate activity
    // BMR = 10*80 + 6.25*175 - 5*30 + 5 = 800+1093.75-150+5 = 1748.75
    // TDEE = 1748.75 * 1.55 = 2710.5625
    const result = calcInitialTdee({ sex: 'male', age: 30, heightCm: 175, weightKg: 80, activityLevel: 'moderate' })
    expect(result).toBeCloseTo(2710.56, 1)
  })

  it('calculates female BMR correctly', () => {
    // Female, 28yo, 167cm, 65kg, light activity
    // BMR = 10*65 + 6.25*167 - 5*28 - 161 = 650+1043.75-140-161 = 1392.75
    // TDEE = 1392.75 * 1.375 = 1914.53
    const result = calcInitialTdee({ sex: 'female', age: 28, heightCm: 167, weightKg: 65, activityLevel: 'light' })
    expect(result).toBeCloseTo(1914.53, 1)
  })
})

describe('calcAdaptiveTdee', () => {
  it('returns null when fewer than 14 logs provided', () => {
    const logs = Array.from({ length: 13 }, (_, i) => ({
      caloriesKcal: 1800,
      weightKg: 80 - i * 0.05,
      logDate: `2026-07-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(calcAdaptiveTdee(logs)).toBeNull()
  })

  it('returns null when fewer than 2 weight entries', () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({
      caloriesKcal: 1800,
      weightKg: i === 0 ? 80 : null,
      logDate: `2026-07-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(calcAdaptiveTdee(logs)).toBeNull()
  })

  it('calculates adaptive TDEE correctly for a deficit', () => {
    // 28 logs, avg 1800 kcal/day, lost 0.5kg/week = 2kg over 4 weeks
    // daily deficit from weight: (2 * 7700) / 28 = 550 kcal/day
    // adaptive TDEE = 1800 + 550 = 2350
    const logs = Array.from({ length: 28 }, (_, i) => ({
      caloriesKcal: 1800,
      weightKg: 82 - (i * (2 / 27)),
      logDate: `2026-07-${String(i + 1).padStart(2, '0')}`,
    }))
    const result = calcAdaptiveTdee(logs)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(2350, 0)
  })
})
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
npm test
```
Expected: FAIL — `calcInitialTdee` and `calcAdaptiveTdee` not defined.

- [ ] **Step 4: Implement the TDEE engine**

```typescript
// src/lib/tdee.ts

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS

export interface TdeeInputs {
  sex: 'male' | 'female'
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
}

/** Mifflin-St Jeor BMR × activity multiplier */
export function calcInitialTdee(inputs: TdeeInputs): number {
  const { sex, age, heightCm, weightKg, activityLevel } = inputs
  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

export interface LogEntry {
  caloriesKcal: number
  weightKg: number | null
  logDate: string
}

/**
 * Adaptive TDEE from rolling log window.
 * Returns null if insufficient data (< 14 logs or < 2 weight entries).
 */
export function calcAdaptiveTdee(logs: LogEntry[]): number | null {
  if (logs.length < 14) return null

  const weightLogs = logs
    .filter((l) => l.weightKg !== null)
    .sort((a, b) => a.logDate.localeCompare(b.logDate))

  if (weightLogs.length < 2) return null

  const firstWeight = weightLogs[0].weightKg!
  const lastWeight = weightLogs[weightLogs.length - 1].weightKg!
  const totalWeightChangeKg = lastWeight - firstWeight

  const windowDays = logs.length
  const dailySurplusDeficit = (totalWeightChangeKg * 7700) / windowDays

  const avgCalories =
    logs.reduce((sum, l) => sum + l.caloriesKcal, 0) / logs.length

  return avgCalories - dailySurplusDeficit
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npm test
```
Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tdee.ts src/lib/tdee.test.ts package.json
git commit -m "feat: add TDEE engine — Mifflin-St Jeor + adaptive recalculation"
```

---

## Task 4: Auth (NextAuth.js v5 + Credentials)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/validations.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/register/route.ts`

- [ ] **Step 1: Generate NextAuth secret**

```bash
openssl rand -base64 32
```
Copy the output into `.env.local` as `NEXTAUTH_SECRET=<value>`.

- [ ] **Step 2: Create Zod validations**

```typescript
// src/lib/validations.ts
import { z } from 'zod'

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const ProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sex: z.enum(['male', 'female']),
  age: z.number().int().min(10).max(120),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  tdeeWindowDays: z.number().int().min(14).max(56).default(28),
})

export const DailyLogSchema = z.object({
  profileId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  caloriesKcal: z.number().min(0).max(20000),
  weightKg: z.number().min(20).max(500).nullable().optional(),
  notes: z.string().max(500).optional(),
})
```

- [ ] **Step 3: Create NextAuth config**

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { LoginSchema } from './validations'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        if (!user) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
```

- [ ] **Step 4: Create the auth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 5: Create the register API route**

```typescript
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
```

- [ ] **Step 6: Add `id` to NextAuth session type** — create `src/types/next-auth.d.ts`:

```typescript
// src/types/next-auth.d.ts
import 'next-auth'
declare module 'next-auth' {
  interface Session {
    user: { id: string; name: string; email: string }
  }
}
```

- [ ] **Step 7: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/lib/validations.ts src/app/api/ src/types/
git commit -m "feat: add NextAuth credentials auth + register API"
```

---

## Task 5: Profile API Routes

**Files:**
- Create: `src/app/api/profiles/route.ts`
- Create: `src/app/api/profiles/[id]/route.ts`

- [ ] **Step 1: Create GET + POST /api/profiles**

```typescript
// src/app/api/profiles/route.ts
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
```

- [ ] **Step 2: Create GET + PUT + DELETE /api/profiles/[id]**

```typescript
// src/app/api/profiles/[id]/route.ts
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
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/profiles/
git commit -m "feat: add profiles API — CRUD with TDEE calculation on create/update"
```

---

## Task 6: Daily Log API Routes (with Adaptive TDEE trigger)

**Files:**
- Create: `src/app/api/logs/route.ts`
- Create: `src/app/api/logs/[id]/route.ts`

- [ ] **Step 1: Create GET + POST /api/logs**

```typescript
// src/app/api/logs/route.ts
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
```

- [ ] **Step 2: Create PUT + DELETE /api/logs/[id]**

```typescript
// src/app/api/logs/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, dailyLogs, profiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { DailyLogSchema } from '@/lib/validations'
import { calcAdaptiveTdee } from '@/lib/tdee'
import { gte, desc } from 'drizzle-orm'

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
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/logs/
git commit -m "feat: add daily logs API with adaptive TDEE recalculation on every save"
```

---

## Task 7: Database Migration

**Files:**
- Create: `drizzle/` (auto-generated)

- [ ] **Step 1: Provision Vercel Postgres**

1. Go to [vercel.com](https://vercel.com) → your project → **Storage** tab → **Create Database** → **Postgres**
2. Name it `tdee-tracker-db`
3. Click **Connect** — Vercel auto-populates env vars in the project
4. In the Vercel dashboard → **Settings → Environment Variables** → copy `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` into your local `.env.local`

- [ ] **Step 2: Generate migration**

```bash
npx drizzle-kit generate
```
Expected: creates `drizzle/0000_initial.sql`

- [ ] **Step 3: Run migration**

```bash
npx drizzle-kit migrate
```
Expected: `✓ migrations applied`

- [ ] **Step 4: Verify tables exist** (optional — use Vercel Postgres dashboard or `drizzle-kit studio`)

```bash
npx drizzle-kit studio
```
Open `https://local.drizzle.studio` — you should see `users`, `profiles`, `daily_logs` tables.

- [ ] **Step 5: Commit**

```bash
git add drizzle/
git commit -m "feat: add initial database migration"
```

---

## Task 8: UI Components

**Files:**
- Create: `src/components/ProfileSwitcher.tsx`
- Create: `src/components/TDEECard.tsx`
- Create: `src/components/CalorieProgressBar.tsx`
- Create: `src/components/DailyLogForm.tsx`
- Create: `src/components/WeightChart.tsx`
- Create: `src/components/CalorieChart.tsx`
- Create: `src/components/LogHistoryTable.tsx`

- [ ] **Step 1: ProfileSwitcher**

```typescript
// src/components/ProfileSwitcher.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Profile } from '@/lib/db/schema'

interface Props { profiles: Profile[]; activeId: string }

export function ProfileSwitcher({ profiles, activeId }: Props) {
  const router = useRouter()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => router.push(`/dashboard?profile=${p.id}`)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            p.id === activeId
              ? 'bg-violet-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {p.name}
        </button>
      ))}
      <button
        onClick={() => router.push('/profiles/new')}
        className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      >
        + Add
      </button>
    </div>
  )
}
```

- [ ] **Step 2: TDEECard**

```typescript
// src/components/TDEECard.tsx
import type { Profile } from '@/lib/db/schema'

interface Props { profile: Profile }

export function TDEECard({ profile }: Props) {
  const tdee = profile.adaptiveTdee
    ? Number(profile.adaptiveTdee)
    : Number(profile.initialTdee)
  const isAdaptive = !!profile.adaptiveTdee

  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
        {isAdaptive ? 'Adaptive TDEE' : 'Initial TDEE'}
      </p>
      <p className="text-3xl font-bold text-white">
        {Math.round(tdee).toLocaleString()}
        <span className="text-sm font-normal text-zinc-400 ml-1">kcal/day</span>
      </p>
      <p className="text-xs text-zinc-500 mt-1">
        {isAdaptive ? `Based on last ${profile.tdeeWindowDays} days` : 'Mifflin-St Jeor estimate'}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: CalorieProgressBar**

```typescript
// src/components/CalorieProgressBar.tsx
interface Props { consumed: number; tdee: number }

export function CalorieProgressBar({ consumed, tdee }: Props) {
  const pct = Math.min((consumed / tdee) * 100, 100)
  const deficit = tdee - consumed
  const isOver = consumed > tdee

  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
        Today's Intake
      </p>
      <div className="flex justify-between items-end mb-2">
        <span className="text-2xl font-bold text-white">{consumed.toLocaleString()}</span>
        <span className={`text-sm font-medium ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
          {isOver ? `+${(consumed - tdee).toLocaleString()} surplus` : `−${deficit.toLocaleString()} deficit`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500 mt-1">
        <span>0</span><span>{tdee.toLocaleString()} goal</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: DailyLogForm**

```typescript
// src/components/DailyLogForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DailyLog } from '@/lib/db/schema'

interface Props {
  profileId: string
  existingLog?: DailyLog
  defaultDate?: string
}

export function DailyLogForm({ profileId, existingLog, defaultDate }: Props) {
  const router = useRouter()
  const [calories, setCalories] = useState(existingLog ? String(existingLog.caloriesKcal) : '')
  const [weight, setWeight] = useState(existingLog?.weightKg ? String(existingLog.weightKg) : '')
  const [notes, setNotes] = useState(existingLog?.notes ?? '')
  const [date, setDate] = useState(existingLog?.logDate ?? defaultDate ?? new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        profileId,
        logDate: date,
        caloriesKcal: Number(calories),
        weightKg: weight ? Number(weight) : null,
        notes: notes || undefined,
      }
      const url = existingLog ? `/api/logs/${existingLog.id}` : '/api/logs'
      const method = existingLog ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed to save log')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Calories (kcal) *</label>
        <input type="number" value={calories} onChange={e => setCalories(e.target.value)} required min={0} max={20000}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" placeholder="e.g. 1800" />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Weight (kg) <span className="text-zinc-600">— optional</span></label>
        <input type="number" value={weight} onChange={e => setWeight(e.target.value)} min={20} max={500} step={0.1}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" placeholder="e.g. 80.5" />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Notes <span className="text-zinc-600">— optional</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 resize-none" placeholder="Rest day, cheat meal..." />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full rounded-xl bg-emerald-500 text-black font-semibold py-3 text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors">
        {loading ? 'Saving…' : existingLog ? 'Update Entry' : 'Save Log Entry'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: WeightChart**

```typescript
// src/components/WeightChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { DailyLog } from '@/lib/db/schema'

interface Props { logs: DailyLog[] }

export function WeightChart({ logs }: Props) {
  const data = logs
    .filter(l => l.weightKg !== null)
    .sort((a, b) => a.logDate.localeCompare(b.logDate))
    .map(l => ({ date: l.logDate.slice(5), weight: Number(l.weightKg) }))

  if (data.length < 2) return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-center text-zinc-500 text-sm py-8">
      Log weight in at least 2 entries to see the trend.
    </div>
  )

  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-3">Weight Trend (kg)</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff' }} />
          <Line type="monotone" dataKey="weight" stroke="#6c63ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 6: CalorieChart**

```typescript
// src/components/CalorieChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import type { DailyLog, Profile } from '@/lib/db/schema'

interface Props { logs: DailyLog[]; profile: Profile }

export function CalorieChart({ logs, profile }: Props) {
  const tdee = Number(profile.adaptiveTdee ?? profile.initialTdee)
  const data = logs
    .sort((a, b) => a.logDate.localeCompare(b.logDate))
    .map(l => ({ date: l.logDate.slice(5), calories: Number(l.caloriesKcal) }))

  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Calories vs TDEE</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff' }} />
          <ReferenceLine y={tdee} stroke="#38d9a9" strokeDasharray="4 4" label={{ value: 'TDEE', fill: '#38d9a9', fontSize: 10 }} />
          <Line type="monotone" dataKey="calories" stroke="#ff6584" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 7: LogHistoryTable**

```typescript
// src/components/LogHistoryTable.tsx
import type { DailyLog } from '@/lib/db/schema'
import Link from 'next/link'

interface Props { logs: DailyLog[] }

export function LogHistoryTable({ logs }: Props) {
  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <th className="text-left px-4 py-2.5">Date</th>
            <th className="text-right px-4 py-2.5">Calories</th>
            <th className="text-right px-4 py-2.5">Weight</th>
            <th className="text-right px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-t border-zinc-700">
              <td className="px-4 py-2.5 text-zinc-300">{log.logDate}</td>
              <td className="px-4 py-2.5 text-right text-white">{Number(log.caloriesKcal).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400">{log.weightKg ? `${Number(log.weightKg)} kg` : '—'}</td>
              <td className="px-4 py-2.5 text-right">
                <Link href={`/log?edit=${log.id}`} className="text-violet-400 hover:text-violet-300 text-xs">Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 8: Compile check**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/components/
git commit -m "feat: add all UI components — ProfileSwitcher, TDEECard, charts, log form"
```

---

## Task 9: Pages

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/profiles/new/page.tsx`
- Create: `src/app/profiles/[id]/page.tsx`
- Create: `src/app/log/page.tsx`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Root layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TDEE Tracker',
  description: 'Track calories and adaptive TDEE',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white min-h-screen antialiased">
        <main className="max-w-lg mx-auto px-4 pb-24 pt-6">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Auth middleware — redirect unauthenticated users**

```typescript
// src/middleware.ts
export { auth as middleware } from '@/lib/auth'
export const config = { matcher: ['/dashboard/:path*', '/profiles/:path*', '/log/:path*'] }
```

- [ ] **Step 3: Login page**

```typescript
// src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) { setError('Invalid email or password'); return }
    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8">
      <h1 className="text-2xl font-bold mb-8 text-violet-400">⚡ TDEE Tracker</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 transition-colors">
          Sign In
        </button>
        <p className="text-center text-zinc-500 text-sm">
          No account? <Link href="/register" className="text-violet-400 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Register page**

```typescript
// src/app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Registration failed'); return }
    router.push('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8">
      <h1 className="text-2xl font-bold mb-8 text-violet-400">⚡ TDEE Tracker</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 chars)" required minLength={8}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 transition-colors">
          Create Account
        </button>
        <p className="text-center text-zinc-500 text-sm">
          Have an account? <Link href="/login" className="text-violet-400 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Dashboard page**

```typescript
// src/app/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db, profiles, dailyLogs } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { TDEECard } from '@/components/TDEECard'
import { CalorieProgressBar } from '@/components/CalorieProgressBar'
import Link from 'next/link'

interface Props { searchParams: Promise<{ profile?: string }> }

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { profile: profileId } = await searchParams
  const userProfiles = await db.select().from(profiles).where(eq(profiles.userId, session.user.id))

  if (userProfiles.length === 0) redirect('/profiles/new')

  const activeProfile = userProfiles.find(p => p.id === profileId) ?? userProfiles[0]

  // Today's log
  const today = new Date().toISOString().split('T')[0]
  const [todayLog] = await db.select().from(dailyLogs)
    .where(and(eq(dailyLogs.profileId, activeProfile.id), eq(dailyLogs.logDate, today)))

  // Last 7 days weight logs
  const recentLogs = await db.select().from(dailyLogs)
    .where(eq(dailyLogs.profileId, activeProfile.id))
    .orderBy(desc(dailyLogs.logDate))
    .limit(7)

  const currentTdee = Number(activeProfile.adaptiveTdee ?? activeProfile.initialTdee)
  const todayCalories = todayLog ? Number(todayLog.caloriesKcal) : 0

  const weightLogs = recentLogs.filter(l => l.weightKg)
  const latestWeight = weightLogs[0]?.weightKg ? Number(weightLogs[0].weightKg) : null
  const earliestWeight = weightLogs[weightLogs.length - 1]?.weightKg ? Number(weightLogs[weightLogs.length - 1].weightKg) : null
  const weightChange = latestWeight && earliestWeight ? latestWeight - earliestWeight : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link href="/log" className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium hover:bg-violet-500">
          + Log Today
        </Link>
      </div>

      <ProfileSwitcher profiles={userProfiles} activeId={activeProfile.id} />
      <TDEECard profile={activeProfile} />
      <CalorieProgressBar consumed={todayCalories} tdee={currentTdee} />

      {latestWeight && (
        <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-1">Weight</p>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold">{latestWeight} <span className="text-sm text-zinc-400">kg</span></span>
            {weightChange !== null && (
              <span className={`text-sm font-medium ${weightChange <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg (7d)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link href={`/profiles/${activeProfile.id}`} className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 p-3 text-center text-sm text-zinc-400 hover:border-violet-500">
          📈 History
        </Link>
        <Link href={`/profiles/${activeProfile.id}?tab=settings`} className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 p-3 text-center text-sm text-zinc-400 hover:border-violet-500">
          ⚙️ Profile
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: New profile page**

```typescript
// src/app/profiles/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little or no exercise' },
  { value: 'light', label: 'Light', sub: '1–3 days/week' },
  { value: 'moderate', label: 'Moderate', sub: '3–5 days/week' },
  { value: 'active', label: 'Active', sub: '6–7 days/week' },
  { value: 'very_active', label: 'Very Active', sub: 'Hard daily exercise' },
]

export default function NewProfilePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', sex: 'female', age: '', heightCm: '', weightKg: '', activityLevel: 'moderate' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const payload = { ...form, age: Number(form.age), heightCm: Number(form.heightCm), weightKg: Number(form.weightKg) }
    const res = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">New Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Alice"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Sex *</label>
          <div className="flex gap-2">
            {['female', 'male'].map(s => (
              <button key={s} type="button" onClick={() => set('sex', s)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${form.sex === s ? 'bg-violet-600 text-white' : 'bg-zinc-800 border border-zinc-700 text-zinc-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Age *</label>
            <input type="number" value={form.age} onChange={e => set('age', e.target.value)} required min={10} max={120}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" placeholder="30" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Height (cm) *</label>
            <input type="number" value={form.heightCm} onChange={e => set('heightCm', e.target.value)} required min={50} max={300}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" placeholder="170" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Weight (kg) *</label>
            <input type="number" value={form.weightKg} onChange={e => set('weightKg', e.target.value)} required min={20} max={500} step={0.1}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" placeholder="75" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Activity Level *</label>
          <div className="space-y-2">
            {ACTIVITY_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => set('activityLevel', opt.value)}
                className={`w-full rounded-lg px-4 py-2.5 text-left transition-colors ${form.activityLevel === opt.value ? 'bg-violet-600/20 border border-violet-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-zinc-500 ml-2">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors">
          {loading ? 'Creating…' : 'Create Profile'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Profile history page**

```typescript
// src/app/profiles/[id]/page.tsx
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db, profiles, dailyLogs } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { TDEECard } from '@/components/TDEECard'
import { WeightChart } from '@/components/WeightChart'
import { CalorieChart } from '@/components/CalorieChart'
import { LogHistoryTable } from '@/components/LogHistoryTable'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function ProfilePage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.userId, session.user.id)))
  if (!profile) notFound()

  const logs = await db.select().from(dailyLogs)
    .where(eq(dailyLogs.profileId, id))
    .orderBy(desc(dailyLogs.logDate))
    .limit(56)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300">←</Link>
        <h1 className="text-xl font-bold">{profile.name}</h1>
      </div>
      <TDEECard profile={profile} />
      <WeightChart logs={logs} />
      <CalorieChart logs={logs} profile={profile} />
      <LogHistoryTable logs={logs} />
    </div>
  )
}
```

- [ ] **Step 8: Daily log page**

```typescript
// src/app/log/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db, profiles, dailyLogs } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { DailyLogForm } from '@/components/DailyLogForm'
import Link from 'next/link'

interface Props { searchParams: Promise<{ profile?: string; edit?: string }> }

export default async function LogPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { profile: profileId, edit: editId } = await searchParams

  const userProfiles = await db.select().from(profiles).where(eq(profiles.userId, session.user.id))
  if (userProfiles.length === 0) redirect('/profiles/new')

  const activeProfile = userProfiles.find(p => p.id === profileId) ?? userProfiles[0]

  let existingLog = undefined
  if (editId) {
    const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, editId))
    existingLog = log
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300">←</Link>
        <h1 className="text-xl font-bold">{existingLog ? 'Edit Entry' : 'Log Today'}</h1>
      </div>
      <DailyLogForm
        profileId={activeProfile.id}
        existingLog={existingLog}
        defaultDate={new Date().toISOString().split('T')[0]}
      />
    </div>
  )
}
```

- [ ] **Step 9: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/ src/middleware.ts
git commit -m "feat: add all pages — dashboard, log entry, profile, history"
```

---

## Task 10: Vercel Deploy

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Install Vercel CLI**

```bash
npm install -g vercel
```

- [ ] **Step 2: Link project to Vercel**

```bash
vercel link
```
Follow prompts: select your team/account, create a new project named `tdee-tracker`.

- [ ] **Step 3: Pull env vars from Vercel into local**

```bash
vercel env pull .env.local
```
This syncs the Postgres connection strings Vercel already set up when you provisioned the DB.

- [ ] **Step 4: Run locally to verify**

```bash
npm run dev
```
Open `http://localhost:3000` — navigate to `/register`, create an account, create a profile. Confirm the initial TDEE appears on the dashboard.

- [ ] **Step 5: Deploy to Vercel**

```bash
vercel --prod
```
Expected output includes a live URL like `https://tdee-tracker-xxx.vercel.app`.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: production-ready — deploy to Vercel"
git push
```

---

## Summary

| Task | Outcome |
|------|---------|
| 1. Scaffold | Next.js 15 project with all deps installed |
| 2. Schema | Drizzle schema for users/profiles/daily_logs |
| 3. TDEE Engine | Mifflin-St Jeor + adaptive calc, fully tested |
| 4. Auth | NextAuth credentials login + register API |
| 5. Profiles API | CRUD with auto-TDEE calculation |
| 6. Logs API | CRUD with adaptive TDEE trigger on every save |
| 7. Migration | Tables created in Vercel Postgres |
| 8. Components | All UI components — cards, charts, forms |
| 9. Pages | Dashboard, log, profile, history, auth pages |
| 10. Deploy | Live on Vercel |
