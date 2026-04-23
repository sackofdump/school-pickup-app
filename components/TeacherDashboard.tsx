'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QueueEntry {
  id: string
  arrived_at: string
  status: string
  location_verified: boolean
  students: { id: string; full_name: string; grade: string; class_name: string } | null
  profiles: { full_name: string } | null
}

interface Props {
  initialQueue: QueueEntry[]
  teacherName: string
}

export default function TeacherDashboard({ initialQueue, teacherName }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(initialQueue)
  const [marking, setMarking] = useState<Record<string, boolean>>({})

  const fetchQueue = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const supabase = createClient()
    const { data } = await supabase
      .from('pickup_queue')
      .select(`
        id, arrived_at, status, location_verified,
        students(id, full_name, grade, class_name),
        profiles!pickup_queue_parent_id_fkey(full_name)
      `)
      .eq('status', 'waiting')
      .gte('arrived_at', `${today}T00:00:00`)
      .order('arrived_at', { ascending: true })

    if (data) setQueue(data as unknown as QueueEntry[])
  }, [])

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('pickup_queue_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pickup_queue' },
        () => { fetchQueue() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchQueue])

  async function markPickedUp(entryId: string) {
    setMarking(prev => ({ ...prev, [entryId]: true }))

    const res = await fetch(`/api/queue/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'picked_up' }),
    })

    if (res.ok) {
      setQueue(prev => prev.filter(e => e.id !== entryId))
    }
    setMarking(prev => ({ ...prev, [entryId]: false }))
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function waitingMinutes(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pickup Queue</h1>
          <p className="text-gray-500 text-sm">Welcome, {teacherName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-800 font-bold text-sm px-3 py-1.5 rounded-full">
            {queue.length} waiting
          </span>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {queue.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-xl font-semibold text-gray-500">All clear!</p>
            <p className="mt-1 text-sm">No parents waiting right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((entry, index) => {
              const student = entry.students
              const parent = entry.profiles
              const waited = waitingMinutes(entry.arrived_at)

              return (
                <div
                  key={entry.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4 ${
                    waited >= 5 ? 'border-amber-300' : 'border-gray-100'
                  }`}
                >
                  {/* Position badge */}
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base">
                      {student?.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {student?.grade && `Grade ${student.grade}`}
                      {student?.grade && student?.class_name && ' · '}
                      {student?.class_name}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Parent: {parent?.full_name ?? '—'} · Arrived {formatTime(entry.arrived_at)}
                      {waited >= 5 && (
                        <span className="text-amber-500 ml-1">· Waiting {waited}m</span>
                      )}
                    </p>
                  </div>

                  {/* Location badge */}
                  {entry.location_verified && (
                    <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full shrink-0">
                      📍 Verified
                    </span>
                  )}

                  {/* Action */}
                  <button
                    onClick={() => markPickedUp(entry.id)}
                    disabled={marking[entry.id]}
                    className="shrink-0 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors"
                  >
                    {marking[entry.id] ? '…' : 'Picked Up ✓'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
