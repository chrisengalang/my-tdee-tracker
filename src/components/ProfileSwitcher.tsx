'use client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/db/schema'

interface Props { profiles: Profile[]; activeId: string }

export function ProfileSwitcher({ profiles, activeId }: Props) {
  const router = useRouter()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => router.push(`/dashboard?profile=${p.id}`)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            p.id === activeId
              ? 'bg-violet-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {p.name}
        </button>
      ))}
      <button
        onClick={() => router.push('/profiles/new')}
        className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
      >
        + Add
      </button>
    </div>
  )
}
