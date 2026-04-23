'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  initialAbsentIds: string[]
}

type SidebarFilter = 'all' | 'waiting' | 'picked_up' | 'not_yet' | 'absent'

export default function TeacherDashboard({ initialQueue, teacherName, allStudents, initialStudentStatuses, initialAbsentIds }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(initialQueue)
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'waiting' | 'picked_up'>>(initialStudentStatuses)
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all')
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set(initialAbsentIds))
  const [absentLoading, setAbsentLoading] = useState<Record<string, boolean>>({})
  const [absentError, setAbsentError] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]

  const supabase = useMemo(() => createClient(), [])

  const fetchQueue = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]

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
      for (const e of entries) {
        map[e.student_id] = e.status
      }
      setStudentStatuses(map)
    }
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel('pickup_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_queue' }, () => fetchQueue())
      .subscribe()

    const poll = setInterval(fetchQueue, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [supabase, fetchQueue])

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
      if (entry?.students?.id) {
        setStudentStatuses(prev => ({ ...prev, [entry.students!.id]: 'picked_up' }))
      }
    }
    setMarking(prev => ({ ...prev, [entryId]: false }))
  }

  async function toggleAbsent(studentId: string) {
    setAbsentLoading(prev => ({ ...prev, [studentId]: true }))
    setAbsentError(null)
    const isAbsent = absentIds.has(studentId)
    try {
      const res = await fetch('/api/absences', {
        method: isAbsent ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date: today }),
      })
      if (res.ok) {
        setAbsentIds(prev => {
          const next = new Set(prev)
          isAbsent ? next.delete(studentId) : next.add(studentId)
          return next
        })
      } else {
        const data = await res.json().catch(() => ({}))
        setAbsentError(data.error ?? `Error ${res.status} — could not update absence`)
      }
    } catch {
      setAbsentError('Network error — check your connection')
    } finally {
      setAbsentLoading(prev => ({ ...prev, [studentId]: false }))
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function waitingMinutes(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  }

  const statusOrder = (id: string) => {
    const s = studentStatuses[id]
    if (s === 'waiting') return 0
    if (s === 'picked_up') return 1
    return 2
  }

  const searchedStudents = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    s.grade?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(sidebarSearch.toLowerCase())
  )

  const pickedUpCount = Object.values(studentStatuses).filter(s => s === 'picked_up').length
  const waitingCount = Object.values(studentStatuses).filter(s => s === 'waiting').length
  const absentCount = absentIds.size
  const notYetCount = allStudents.length - pickedUpCount - waitingCount - absentCount

  const sidebarStudents = useMemo(() => {
    const present = searchedStudents.filter(s => !absentIds.has(s.id))
    const absent = searchedStudents.filter(s => absentIds.has(s.id))

    // Absent tab: show all students so you can mark/unmark any of them
    if (sidebarFilter === 'absent') return [...absent, ...present.sort((a, b) => a.full_name.localeCompare(b.full_name))]
    if (sidebarFilter === 'waiting') return present.filter(s => studentStatuses[s.id] === 'waiting')
    if (sidebarFilter === 'picked_up') return present.filter(s => studentStatuses[s.id] === 'picked_up')
    if (sidebarFilter === 'not_yet') return present.filter(s => !studentStatuses[s.id])

    // 'all': waiting → picked_up → not_yet → absent
    return [
      ...present.sort((a, b) => statusOrder(a.id) - statusOrder(b.id)),
      ...absent,
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchedStudents, absentIds, sidebarFilter, studentStatuses])

  function toggleFilter(f: SidebarFilter) {
    setSidebarFilter(prev => prev === f ? 'all' : f)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden shrink-0 bg-white border-r border-gray-200 flex flex-col`}>
        <div className="p-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm mb-2">All Students</p>

          {/* Clickable filter badges */}
          <div className="flex gap-1.5 text-xs mb-3 flex-wrap">
            <button
              onClick={() => toggleFilter('picked_up')}
              className={`px-2 py-0.5 rounded-full transition-colors ${sidebarFilter === 'picked_up' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              ✅ {pickedUpCount} picked up
            </button>
            <button
              onClick={() => toggleFilter('waiting')}
              className={`px-2 py-0.5 rounded-full transition-colors ${sidebarFilter === 'waiting' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
            >
              ⏳ {waitingCount} waiting
            </button>
            <button
              onClick={() => toggleFilter('not_yet')}
              className={`px-2 py-0.5 rounded-full transition-colors ${sidebarFilter === 'not_yet' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              🔴 {notYetCount} not yet
            </button>
            <button
              onClick={() => toggleFilter('absent')}
              className={`px-2 py-0.5 rounded-full transition-colors ${sidebarFilter === 'absent' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
            >
              🤒 {absentCount} absent
            </button>
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
          {sidebarStudents.map(student => {
            const isAbsent = absentIds.has(student.id)
            const status = studentStatuses[student.id]
            const isPickedUp = !isAbsent && status === 'picked_up'
            const isWaiting = !isAbsent && status === 'waiting'

            return (
              <div
                key={student.id}
                className={`group rounded-lg px-3 py-2.5 border transition-colors ${
                  isAbsent     ? 'bg-orange-50 border-orange-200'
                  : isPickedUp ? 'bg-green-50 border-green-200'
                  : isWaiting  ? 'bg-amber-50 border-amber-200'
                  :              'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`font-medium text-sm ${
                    isAbsent     ? 'text-orange-700'
                    : isPickedUp ? 'text-green-800'
                    : isWaiting  ? 'text-amber-800'
                    :              'text-red-800'
                  }`}>
                    {student.full_name}
                  </p>
                  <div className="flex items-center gap-1">
                    {sidebarFilter === 'absent' && (
                      <button
                        onClick={() => toggleAbsent(student.id)}
                        disabled={absentLoading[student.id]}
                        title={isAbsent ? 'Mark present' : 'Mark absent'}
                        className={`text-xs transition-colors px-1 disabled:opacity-40 ${
                          isAbsent
                            ? 'text-orange-400 hover:text-gray-500'
                            : 'text-gray-300 hover:text-orange-500 active:text-orange-600'
                        }`}
                      >
                        {isAbsent ? '↩' : '🤒'}
                      </button>
                    )}
                    <span className="text-base">
                      {isAbsent ? '🟠' : isPickedUp ? '✅' : isWaiting ? '⏳' : '🔴'}
                    </span>
                  </div>
                </div>
                <p className={`text-xs mt-0.5 ${
                  isAbsent     ? 'text-orange-500'
                  : isPickedUp ? 'text-green-600'
                  : isWaiting  ? 'text-amber-600'
                  :              'text-red-500'
                }`}>
                  {student.grade && `Grade ${student.grade}`}
                  {student.grade && student.class_name && ' · '}
                  {student.class_name}
                  {isAbsent && ' · Absent today'}
                </p>
              </div>
            )
          })}

          {sidebarStudents.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-6">No students match this filter.</p>
          )}
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

        {absentError && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-600 flex items-center justify-between">
            <span>⚠️ {absentError}</span>
            <button onClick={() => setAbsentError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

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
                const isStudentAbsent = student?.id ? absentIds.has(student.id) : false

                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4 ${
                      isStudentAbsent ? 'border-orange-300 bg-orange-50'
                      : waited >= 5   ? 'border-amber-300'
                      :                 'border-gray-100'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 ${
                      isStudentAbsent ? 'bg-orange-400' : 'bg-blue-600'
                    }`}>
                      {isStudentAbsent ? '🤒' : index + 1}
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
                        {isStudentAbsent && <span className="text-orange-500 ml-1">· Marked absent</span>}
                        {!isStudentAbsent && waited >= 5 && <span className="text-amber-500 ml-1">· Waiting {waited}m</span>}
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
