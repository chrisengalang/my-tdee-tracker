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
    // TDEE = 1392.75 * 1.375 = 1915.03125
    const result = calcInitialTdee({ sex: 'female', age: 28, heightCm: 167, weightKg: 65, activityLevel: 'light' })
    expect(result).toBeCloseTo(1915.03, 1)
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
    // 28 logs, avg 1800 kcal/day, lost 2kg over 28 days
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
