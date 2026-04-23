'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
  absent: boolean
}

interface Props {
  students: Student[]
  date: string
  backHref: string
}

export default function AbsencesManager({ students: initial, date, backHref }: Props) {
  const [students, setStudents] = useState(initial)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const absentStudents = students.filter(s => s.absent)

  async function toggle(student: Student) {
    setLoading(prev => ({ ...prev, [student.id]: true }))
    setError(null)
    try {
      const res = await fetch('/api/absences', {
        method: student.absent ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, date }),
      })

      if (res.ok) {
        setStudents(prev => prev.map(s =>
          s.id === student.id ? { ...s, absent: !s.absent } : s
        ))
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Error ${res.status} — could not update absence`)
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(prev => ({ ...prev, [student.id]: false }))
    }
  }

  const filtered = students
    .filter(s =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.grade?.toLowerCase().includes(search.toLowerCase()) ||
      s.class_name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => Number(a.absent) - Number(b.absent))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Absent Today</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 mb-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

        {/* Absent today panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-800 shadow-sm mb-6 overflow-hidden">
          <div className="bg-orange-50 dark:bg-orange-900/30 px-4 py-3 border-b border-orange-100 dark:border-orange-800 flex items-center justify-between">
            <p className="font-semibold text-orange-800 dark:text-orange-300">Absent Today</p>
            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">
              {absentStudents.length === 0 ? 'None' : `${absentStudents.length} student${absentStudents.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {absentStudents.length === 0 ? (
            <p className="px-4 py-5 text-sm text-gray-400 dark:text-gray-500 text-center">No one marked absent yet.</p>
          ) : (
            <div className="divide-y divide-orange-50 dark:divide-orange-900/20">
              {absentStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-orange-800 dark:text-orange-300">{s.full_name}</p>
                    <p className="text-xs text-orange-500 dark:text-orange-400">
                      {s.grade && `Grade ${s.grade}`}
                      {s.grade && s.class_name && ' · '}
                      {s.class_name}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(s)}
                    disabled={loading[s.id]}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                  >
                    {loading[s.id] ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* All students */}
        <div className="space-y-2">
          {filtered.map(student => (
            <div
              key={student.id}
              className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
                student.absent
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'
              }`}
            >
              <div>
                <p className={`font-medium ${student.absent ? 'text-orange-800 dark:text-orange-300' : 'text-gray-900 dark:text-white'}`}>
                  {student.full_name}
                </p>
                <p className={`text-xs ${student.absent ? 'text-orange-400 dark:text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  {student.grade && `Grade ${student.grade}`}
                  {student.grade && student.class_name && ' · '}
                  {student.class_name}
                  {student.absent && ' · Absent'}
                </p>
              </div>
              <button
                onClick={() => toggle(student)}
                disabled={loading[student.id]}
                className={`text-sm rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-40 ${
                  student.absent
                    ? 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700'
                    : 'text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                }`}
              >
                {loading[student.id] ? '…' : student.absent ? 'Mark Present' : 'Mark Absent'}
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p>No students match "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
