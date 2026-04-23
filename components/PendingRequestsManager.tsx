'use client'

import { useState } from 'react'
import Link from 'next/link'

interface PendingRequest {
  id: string
  child_first_name: string
  child_last_name: string
  status: string
  created_at: string
  profiles: { full_name: string; email: string } | null
}

interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
}

interface Props {
  requests: PendingRequest[]
  students: Student[]
}

export default function PendingRequestsManager({ requests: initial, students }: Props) {
  const [requests, setRequests] = useState(initial)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [selectedStudent, setSelectedStudent] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const studentId = selectedStudent[id]
    if (action === 'approve' && !studentId) {
      setError('Please select a student to link before approving.')
      return
    }
    setLoading(prev => ({ ...prev, [id]: true }))
    setError(null)
    try {
      const res = await fetch('/api/pending-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, student_id: studentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
      } else {
        setRequests(prev => prev.filter(r => r.id !== id))
      }
    } catch {
      setError('Network error — check your connection.')
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">← Admin</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Link Requests</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Parents waiting for a student to be linked</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 mb-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center text-gray-400 dark:text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="mb-3">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {req.child_first_name} {req.child_last_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Requested by <span className="font-medium">{req.profiles?.full_name ?? 'Unknown'}</span>
                    {' '}({req.profiles?.email ?? '—'})
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Link to existing student
                  </label>
                  <select
                    value={selectedStudent[req.id] ?? ''}
                    onChange={e => setSelectedStudent(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— Select student —</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}{s.grade ? ` (Grade ${s.grade})` : ''}{s.class_name ? ` · ${s.class_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={loading[req.id]}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold text-sm rounded-lg py-2 transition-colors"
                  >
                    {loading[req.id] ? '…' : 'Approve & Link'}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={loading[req.id]}
                    className="px-4 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
