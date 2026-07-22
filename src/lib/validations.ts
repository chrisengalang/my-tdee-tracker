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
