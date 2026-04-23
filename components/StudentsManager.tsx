'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function ParentTag({ p, onUnlink }: { p: { id: string; full_name: string; email: string }; onUnlink: () => void }) {
  const [showEmail, setShowEmail] = useState(false)
  const displayName = p.full_name || p.email

  return (
    <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full px-3 py-1 flex items-center gap-1">
      <span>
        {displayName}
        {p.full_name && (
          <button
            onClick={() => setShowEmail(v => !v)}
            className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 ml-1"
          >
            {showEmail ? `(${p.email})` : '(···)'}
          </button>
        )}
      </span>
      <button
        onClick={onUnlink}
        className="text-blue-400 hover:text-red-500 dark:text-blue-500 dark:hover:text-red-400 font-bold ml-1"
      >
        ×
      </button>
    </span>
  )
}

interface Parent { id: string; full_name: string; email: string }
interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
  parent_students: { parent_id: string; profiles: Parent | null }[]
}

interface Props {
  students: Student[]
  parents: Parent[]
}

export default function StudentsManager({ students: initialStudents, parents }: Props) {
  const router = useRouter()
  const [students, setStudents] = useState(initialStudents)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newClass, setNewClass] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({})
  const [linkLoading, setLinkLoading] = useState<Record<string, boolean>>({})

  async function addStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError('')

    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: newName.trim(), grade: newGrade, class_name: newClass }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setStudents(prev => [...prev, { ...data.student, parent_students: [] }])
      setNewName('')
      setNewGrade('')
      setNewClass('')
    }
    setAdding(false)
  }

  async function deleteStudent(id: string) {
    if (!confirm('Delete this student?')) return
    await fetch('/api/students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  async function linkParent(studentId: string) {
    const parentId = linkSelections[studentId]
    if (!parentId) return
    setLinkLoading(prev => ({ ...prev, [studentId]: true }))

    const res = await fetch('/api/students/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, parent_id: parentId }),
    })

    if (res.ok) {
      const parent = parents.find(p => p.id === parentId)
      setStudents(prev => prev.map(s =>
        s.id === studentId
          ? { ...s, parent_students: [...s.parent_students, { parent_id: parentId, profiles: parent ?? null }] }
          : s
      ))
      setLinkSelections(prev => ({ ...prev, [studentId]: '' }))
    }
    setLinkLoading(prev => ({ ...prev, [studentId]: false }))
  }

  async function unlinkParent(studentId: string, parentId: string) {
    await fetch('/api/students/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, parent_id: parentId }),
    })
    setStudents(prev => prev.map(s =>
      s.id === studentId
        ? { ...s, parent_students: s.parent_students.filter(ps => ps.parent_id !== parentId) }
        : s
    ))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Students</h1>
        </div>

        {/* Add student form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Add New Student</h2>
          <form onSubmit={addStudent} className="flex flex-wrap gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name *"
              required
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={newGrade}
              onChange={e => setNewGrade(e.target.value)}
              placeholder="Grade"
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={newClass}
              onChange={e => setNewClass(e.target.value)}
              placeholder="Class"
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:bg-blue-300"
            >
              {adding ? 'Adding…' : 'Add Student'}
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Student list */}
        <div className="space-y-3">
          {students.map(student => {
            const linkedParents = student.parent_students.map(ps => ps.profiles).filter(Boolean)
            const unlinkedParents = parents.filter(
              p => !student.parent_students.find(ps => ps.parent_id === p.id)
            )

            return (
              <div key={student.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{student.full_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {student.grade && `Grade ${student.grade}`}
                      {student.grade && student.class_name && ' · '}
                      {student.class_name}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteStudent(student.id)}
                    className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>

                {/* Linked parents */}
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Linked parents</p>
                  {linkedParents.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No parents linked yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {linkedParents.map(p => (
                        <ParentTag
                          key={p!.id}
                          p={p!}
                          onUnlink={() => unlinkParent(student.id, p!.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Link parent */}
                {unlinkedParents.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    <select
                      value={linkSelections[student.id] ?? ''}
                      onChange={e => setLinkSelections(prev => ({ ...prev, [student.id]: e.target.value }))}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Link a parent…</option>
                      {unlinkedParents.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => linkParent(student.id)}
                      disabled={!linkSelections[student.id] || linkLoading[student.id]}
                      className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg px-3 py-1.5"
                    >
                      Link
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {students.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-3xl mb-2">👦</p>
              <p>No students yet. Add one above.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
