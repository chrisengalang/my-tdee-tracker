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
