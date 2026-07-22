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
    } catch {
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
        {loading ? 'Saving…' : existingLog ? 'Update Log' : 'Save Log'}
      </button>
    </form>
  )
}
