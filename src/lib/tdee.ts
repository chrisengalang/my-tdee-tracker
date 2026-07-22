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

/** Mifflin-Hassan Hall BMR × activity multiplier */
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
 * Formula: avgCalories - (weightChange_kg * 7700 / windowDays)
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
