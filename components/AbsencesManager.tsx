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
  const [search, setSearch] = useState('')

  const absentCount = students.filter(s => s.absent).length

  async function toggle(student: Student) {
    setLoading(prev => ({ ...prev, [student.id]: true }))

    const res = await fetch('/api/absences', {
      method: student.absent ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: student.id, date }),
    })

    if (res.ok) {
      setStudents(prev => prev.map(s =>
        s.id === student.id ? { ...s, absent: !s.absent } : s
      ))
    }
    setLoading(prev => ({ ...prev, [student.id]: false }))
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.grade?.toLowerCase().includes(search.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(search.toLowerCase())
  )

  const present = filtered.filter(s => !s.absent)
  const absent = filtered.filter(s => s.absent)

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Absent Today</h1>
            <p className="text-gray-500 text-sm">{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          {absentCount > 0 && (
            <span className="ml-auto bg-orange-100 text-orange-700 font-semibold text-sm px-3 py-1 rounded-full">
              🤒 {absentCount} absent
            </span>
          )}
        </div>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Present students */}
        <div className="space-y-2 mb-6">
          {present.map(student => (
            <div key={student.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{student.full_name}</p>
                <p className="text-xs text-gray-500">
                  {student.grade && `Grade ${student.grade}`}
                  {student.grade && student.class_name && ' · '}
                  {student.class_name}
                </p>
              </div>
              <button
                onClick={() => toggle(student)}
                disabled={loading[student.id]}
                className="text-sm text-orange-500 hover:bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                {loading[student.id] ? '…' : 'Mark Absent'}
              </button>
            </div>
          ))}
        </div>

        {/* Absent students */}
        {absent.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Absent</p>
            <div className="space-y-2">
              {absent.map(student => (
                <div key={student.id} className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤒</span>
                    <div>
                      <p className="font-medium text-orange-800">{student.full_name}</p>
                      <p className="text-xs text-orange-500">
                        {student.grade && `Grade ${student.grade}`}
                        {student.grade && student.class_name && ' · '}
                        {student.class_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(student)}
                    disabled={loading[student.id]}
                    className="text-sm text-gray-500 hover:bg-white border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {loading[student.id] ? '…' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">🔍</p>
            <p>No students match "{search}"</p>
          </div>
        )}
      </div>
    </main>
  )
}
