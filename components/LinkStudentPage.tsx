'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
  linked: boolean
}

interface Parent {
  id: string
  full_name: string
  email: string
}

export default function LinkStudentPage({
  parent,
  students: initialStudents,
}: {
  parent: Parent
  students: Student[]
}) {
  const router = useRouter()
  const [students, setStudents] = useState(initialStudents)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.grade?.toLowerCase().includes(search.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(search.toLowerCase())
  )

  async function toggle(student: Student) {
    setLoading(prev => ({ ...prev, [student.id]: true }))

    const res = await fetch('/api/students/link', {
      method: student.linked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: student.id, parent_id: parent.id }),
    })

    if (res.ok) {
      setStudents(prev =>
        prev.map(s => s.id === student.id ? { ...s, linked: !s.linked } : s)
      )
    }
    setLoading(prev => ({ ...prev, [student.id]: false }))
  }

  const linkedCount = students.filter(s => s.linked).length

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/parents" className="text-gray-400 hover:text-gray-600">← Parents</Link>
          <h1 className="text-2xl font-bold text-gray-900">Link Students</h1>
        </div>

        {/* Parent info */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <p className="font-semibold text-gray-900">{parent.full_name || '—'}</p>
          <p className="text-sm text-gray-500">{parent.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            {linkedCount} student{linkedCount !== 1 ? 's' : ''} linked
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, grade, or class…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        {/* Student list */}
        <div className="space-y-2">
          {filtered.map(student => (
            <div
              key={student.id}
              className={`bg-white rounded-xl px-4 py-3 shadow-sm border flex items-center justify-between transition-colors ${
                student.linked ? 'border-blue-300 bg-blue-50' : 'border-gray-100'
              }`}
            >
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
                className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${
                  student.linked
                    ? 'bg-blue-100 text-blue-700 hover:bg-red-50 hover:text-red-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                }`}
              >
                {loading[student.id] ? '…' : student.linked ? 'Linked ✓' : 'Link'}
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p>No students match "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
