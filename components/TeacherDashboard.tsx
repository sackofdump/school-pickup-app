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

interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
}

interface Props {
  initialQueue: QueueEntry[]
  teacherName: string
  allStudents: Student[]
  initialStudentStatuses: Record<string, 'waiting' | 'picked_up'>
}

export default function TeacherDashboard({ initialQueue, teacherName, allStudents, initialStudentStatuses }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(initialQueue)
  // TODO: remove the filter before going live — clears picked_up on load for testing
  const clearedStatuses = Object.fromEntries(
    Object.entries(initialStudentStatuses).filter(([, v]) => v !== 'picked_up')
  ) as Record<string, 'waiting' | 'picked_up'>
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'waiting' | 'picked_up'>>(clearedStatuses)
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')

  const fetchQueue = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const supabase = createClient()

    const [{ data: queueData }, { data: entries }] = await Promise.all([
      supabase
        .from('pickup_queue')
        .select(`
          id, arrived_at, status, location_verified,
          students(id, full_name, grade, class_name),
          profiles!pickup_queue_parent_id_fkey(full_name)
        `)
        .eq('status', 'waiting')
        .gte('arrived_at', `${today}T00:00:00`)
        .order('arrived_at', { ascending: true }),
      supabase
        .from('pickup_queue')
        .select('student_id, status')
        .gte('arrived_at', `${today}T00:00:00`),
    ])

    if (queueData) setQueue(queueData as unknown as QueueEntry[])
    if (entries) {
      const map: Record<string, 'waiting' | 'picked_up'> = {}
      // TODO: remove the picked_up filter before going live
      for (const e of entries) {
        if (e.status !== 'picked_up') map[e.student_id] = e.status
      }
      setStudentStatuses(prev => {
        // Preserve any picked_up entries that still have a 30s timer running
        const preserved: Record<string, 'waiting' | 'picked_up'> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v === 'picked_up') preserved[k] = v
        }
        return { ...preserved, ...map }
      })
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('pickup_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_queue' }, () => fetchQueue())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchQueue])

  async function markPickedUp(entryId: string) {
    setMarking(prev => ({ ...prev, [entryId]: true }))
    const entry = queue.find(e => e.id === entryId)
    const res = await fetch(`/api/queue/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'picked_up' }),
    })
    if (res.ok) {
      setQueue(prev => prev.filter(e => e.id !== entryId))
      // TODO: remove this timeout before going live
      if (entry?.students?.id) {
        const studentId = entry.students.id
        setTimeout(() => {
          setStudentStatuses(prev => {
            const next = { ...prev }
            delete next[studentId]
            return next
          })
        }, 30000)
      }
    }
    setMarking(prev => ({ ...prev, [entryId]: false }))
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function waitingMinutes(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  }

  const filteredStudents = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    s.grade?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(sidebarSearch.toLowerCase())
  )

  const pickedUpCount = Object.values(studentStatuses).filter(s => s === 'picked_up').length
  const waitingCount = Object.values(studentStatuses).filter(s => s === 'waiting').length

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden shrink-0 bg-white border-r border-gray-200 flex flex-col`}>
        <div className="p-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm mb-1">All Students</p>
          <div className="flex gap-2 text-xs mb-3">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{pickedUpCount} picked up</span>
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{waitingCount} waiting</span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{allStudents.length - pickedUpCount - waitingCount} not yet</span>
          </div>
          <input
            type="text"
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {filteredStudents.map(student => {
            const status = studentStatuses[student.id]
            const isPickedUp = status === 'picked_up'
            const isWaiting = status === 'waiting'

            return (
              <div
                key={student.id}
                className={`rounded-lg px-3 py-2.5 border transition-colors ${
                  isPickedUp
                    ? 'bg-green-50 border-green-200'
                    : isWaiting
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`font-medium text-sm ${
                    isPickedUp ? 'text-green-800' : isWaiting ? 'text-amber-800' : 'text-red-800'
                  }`}>
                    {student.full_name}
                  </p>
                  <span className="text-base">
                    {isPickedUp ? '✅' : isWaiting ? '⏳' : '🔴'}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${
                  isPickedUp ? 'text-green-600' : isWaiting ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {student.grade && `Grade ${student.grade}`}
                  {student.grade && student.class_name && ' · '}
                  {student.class_name}
                </p>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Toggle student list"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pickup Queue</h1>
              <p className="text-gray-500 text-sm">Welcome, {teacherName}</p>
            </div>
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

        <div className="flex-1 overflow-y-auto p-6">
          {queue.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-5xl mb-4">✅</p>
              <p className="text-xl font-semibold text-gray-500">All clear!</p>
              <p className="mt-1 text-sm">No parents waiting right now.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
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
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base">{student?.full_name ?? 'Unknown'}</p>
                      <p className="text-gray-500 text-sm">
                        {student?.grade && `Grade ${student.grade}`}
                        {student?.grade && student?.class_name && ' · '}
                        {student?.class_name}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        Parent: {parent?.full_name ?? '—'} · Arrived {formatTime(entry.arrived_at)}
                        {waited >= 5 && <span className="text-amber-500 ml-1">· Waiting {waited}m</span>}
                      </p>
                    </div>
                    {entry.location_verified && (
                      <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full shrink-0">
                        📍 Verified
                      </span>
                    )}
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
      </div>
    </div>
  )
}
