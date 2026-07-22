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
