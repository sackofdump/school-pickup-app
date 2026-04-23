'use client'

import { useState } from 'react'

export default function ResetQueueButton() {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleReset() {
    setState('loading')
    try {
      const res = await fetch('/api/queue/reset', { method: 'DELETE' })
      if (res.ok) {
        setState('done')
        setTimeout(() => setState('idle'), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Reset failed')
        setState('error')
        setTimeout(() => setState('idle'), 4000)
      }
    } catch {
      setError('Network error')
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  if (state === 'confirming') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-red-200 dark:border-red-700">
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Reset today's pickup list?</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">This clears all check-ins for today. Parents will need to check in again.</p>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
          >
            Yes, reset
          </button>
          <button
            onClick={() => setState('idle')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 text-sm rounded-lg px-4 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setState('confirming')}
      disabled={state === 'loading'}
      className="w-full bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-red-300 dark:hover:border-red-600 transition-colors text-left disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔄</span>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">
            {state === 'loading' ? 'Resetting…'
              : state === 'done' ? 'Reset complete!'
              : state === 'error' ? `Error: ${error}`
              : 'Reset Pickup List'}
          </p>
          <p className={`text-sm ${state === 'done' ? 'text-green-600' : state === 'error' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
            {state === 'done' ? 'All check-ins cleared for today'
              : state === 'error' ? 'Try again or check Supabase'
              : "Clear today's queue so parents can check in again"}
          </p>
        </div>
      </div>
      <span className="text-gray-400 dark:text-gray-500">›</span>
    </button>
  )
}
