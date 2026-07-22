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
