'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Parent {
  id: string
  full_name: string
  email: string
  created_at: string
  parent_students: { student_id: string; students: { full_name: string; grade: string; class_name: string } | null }[]
}

export default function ParentsPage({ initialParents }: { initialParents: Parent[] }) {
  const [parents, setParents] = useState(initialParents)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function addParent(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')

    const res = await fetch('/api/parents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name.trim(), email: email.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setParents(prev => [...prev, {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        created_at: new Date().toISOString(),
        parent_students: [],
      }])
      setName('')
      setEmail('')
    }
    setAdding(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900">Parents</h1>
          <span className="bg-green-100 text-green-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {parents.length}
          </span>
        </div>

        {/* Add parent form */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Add Parent Account</h2>
          <form onSubmit={addParent} className="flex flex-wrap gap-2 items-start">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email *"
              required
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg px-4 py-2"
            >
              {adding ? 'Adding…' : 'Add Parent'}
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <p className="text-xs text-gray-400 mt-2">Temporary password: <code className="bg-gray-100 px-1 rounded">4004</code></p>
        </div>

        {/* Parent list */}
        <div className="space-y-3">
          {parents.map(parent => {
            const children = (parent.parent_students ?? [])
              .map((ps: any) => ps.students)
              .filter(Boolean)

            return (
              <div key={parent.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{parent.full_name || '—'}</p>
                    <p className="text-sm text-gray-500">{parent.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(parent.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {children.map((c: any, i: number) => (
                    <span key={i} className="bg-blue-50 text-blue-700 text-xs rounded-full px-3 py-1">
                      {c.full_name}
                      {c.grade && ` · Grade ${c.grade}`}
                      {c.class_name && ` · ${c.class_name}`}
                    </span>
                  ))}
                  <Link
                    href={`/admin/parents/${parent.id}/link`}
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline italic"
                  >
                    {children.length === 0 ? 'No children linked — click to add' : '+ add more'}
                  </Link>
                </div>
              </div>
            )
          })}

          {parents.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-3xl mb-2">👨‍👩‍👧</p>
              <p>No parent accounts yet.</p>
              <Link href="/admin/import" className="text-blue-500 text-sm mt-1 inline-block hover:underline">
                Import from CSV
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
