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
