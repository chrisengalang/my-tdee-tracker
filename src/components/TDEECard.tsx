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
