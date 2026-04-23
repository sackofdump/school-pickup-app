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
  const [lastTempPassword, setLastTempPassword] = useState('')
  const [lastEmailSent, setLastEmailSent] = useState(false)
  const [lastAlreadyExisted, setLastAlreadyExisted] = useState(false)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  async function addParent(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')
    setLastTempPassword('')
    setLastAlreadyExisted(false)

    const res = await fetch('/api/parents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name.trim(), email: email.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      // Add to list if not already showing
      setParents(prev =>
        prev.find(p => p.id === data.id)
          ? prev
          : [...prev, { id: data.id, full_name: data.full_name, email: data.email, created_at: new Date().toISOString(), parent_students: [] }]
      )
      setLastAlreadyExisted(!!data.already_exists)
      setLastTempPassword(data.already_exists ? '' : (data.temp_password ?? ''))
      setLastEmailSent(!!data.email_sent)
      if (data.email_error) setError(`Account created but email failed: ${data.email_error}`)
      setName('')
      setEmail('')
    }
    setAdding(false)
  }

  async function deleteParent(id: string, displayName: string) {
    if (!confirm(`Delete ${displayName || 'this parent'}? This cannot be undone.`)) return
    setDeleting(prev => ({ ...prev, [id]: true }))

    const res = await fetch('/api/parents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    if (res.ok) {
      setParents(prev => prev.filter(p => p.id !== id))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Delete failed')
    }
    setDeleting(prev => ({ ...prev, [id]: false }))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parents</h1>
          <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {parents.length}
          </span>
        </div>

        {/* Add parent form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Add Parent Account</h2>
          <form onSubmit={addParent} className="flex flex-wrap gap-2 items-start">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email *"
              required
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          {lastAlreadyExisted && (
            <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 mt-2">
              This parent already has an account (they may have children at another school). They've been added to this list — use the link below to connect them to students here.
              {lastEmailSent
                ? <span className="ml-1 text-green-600 dark:text-green-400">A notification email was sent to let them know.</span>
                : null}
            </p>
          )}
          {lastTempPassword && (
            <p className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 mt-2">
              Account created! Temporary password: <code className="font-bold">{lastTempPassword}</code>
              {lastEmailSent
                ? <span className="text-green-500 dark:text-green-400 ml-1">— welcome email sent</span>
                : <span className="text-green-500 dark:text-green-400 ml-1">— share this with the parent</span>}
            </p>
          )}
        </div>

        {/* Parent list */}
        <div className="space-y-3">
          {parents.map(parent => {
            const children = (parent.parent_students ?? [])
              .map((ps: any) => ps.students)
              .filter(Boolean)

            return (
              <div key={parent.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{parent.full_name || '—'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{parent.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(parent.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteParent(parent.id, parent.full_name || parent.email)}
                      disabled={deleting[parent.id]}
                      className="text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
                    >
                      {deleting[parent.id] ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {children.map((c: any, i: number) => (
                    <span key={i} className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full px-3 py-1">
                      {c.full_name}
                      {c.grade && ` · Grade ${c.grade}`}
                      {c.class_name && ` · ${c.class_name}`}
                    </span>
                  ))}
                  <Link
                    href={`/admin/parents/${parent.id}/link`}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline italic"
                  >
                    {children.length === 0 ? 'No children linked — click to add' : '+ add more'}
                  </Link>
                </div>
              </div>
            )
          })}

          {parents.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
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
