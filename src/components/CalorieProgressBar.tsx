interface Props { consumed: number; tdee: number }

export function CalorieProgressBar({ consumed, tdee }: Props) {
  const pct = Math.min((consumed / tdee) * 100, 100)
  const deficit = tdee - consumed
  const isOver = consumed > tdee

  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
        Today&apos;s Intake
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
