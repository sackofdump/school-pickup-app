'use client'

import { useState, useRef, useEffect } from 'react'

interface School {
  id: string
  name: string
}

interface Props {
  schools: School[]
  activeSchoolId: string | null
}

export default function SchoolSwitcherBar({ schools, activeSchoolId }: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const active = schools.find(s => s.id === activeSchoolId)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
        setError('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchSchool(id: string) {
    setLoading(true)
    await fetch('/api/schools/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: id }),
    })
    window.location.href = '/admin'
  }

  async function createSchool(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not create school.')
      setLoading(false)
      return
    }
    await fetch('/api/schools/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: data.school.id }),
    })
    window.location.href = '/admin'
  }

  async function deleteSchool(id: string) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/schools', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not delete school.')
      setLoading(false)
      setConfirmDelete(null)
      return
    }
    // If we deleted the active school, switch to first remaining
    if (id === activeSchoolId) {
      const remaining = schools.filter(s => s.id !== id)
      const next = remaining[0]?.id ?? null
      await fetch('/api/schools/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: next }),
      })
    }
    window.location.href = '/admin'
  }

  return (
    <div className="bg-gray-900 dark:bg-black text-white px-4 py-2 flex items-center gap-3 relative z-50" ref={ref}>
      <span className="text-xs text-gray-400 shrink-0">School:</span>

      <div className="relative">
        <button
          onClick={() => { setOpen(o => !o); setCreating(false); setError('') }}
          className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-blue-300 transition-colors"
        >
          {active ? active.name : <span className="text-gray-400 font-normal">No school selected</span>}
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {error && (
              <p className="px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/30 border-b border-red-100 dark:border-red-800">{error}</p>
            )}

            {schools.length === 0 && !creating && (
              <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No schools yet.</p>
            )}

            {schools.map(school => (
              <div key={school.id} className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-50 dark:border-gray-700 ${school.id === activeSchoolId ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {confirmDelete === school.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-xs text-red-600 dark:text-red-400 flex-1">Delete "{school.name}"?</span>
                    <button onClick={() => deleteSchool(school.id)} disabled={loading} className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">Yes</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:underline">No</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => switchSchool(school.id)}
                      disabled={loading}
                      className="flex-1 text-left text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2"
                    >
                      {school.id === activeSchoolId && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      {school.id !== activeSchoolId && <span className="w-1.5 h-1.5 shrink-0" />}
                      {school.name}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(school.id)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 text-xs px-1 transition-colors"
                      title="Delete school"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}

            {creating ? (
              <form onSubmit={createSchool} className="p-3 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="School name"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button type="submit" disabled={loading || !newName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg px-3 transition-colors">
                  Add
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full px-3 py-2.5 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                + New school
              </button>
            )}
          </div>
        )}
      </div>

      {!active && schools.length === 0 && (
        <span className="text-xs text-amber-400">↑ Create a school to get started</span>
      )}
      {!active && schools.length > 0 && (
        <span className="text-xs text-amber-400">↑ Select a school</span>
      )}
    </div>
  )
}
