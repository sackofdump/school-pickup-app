'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => { window.location.href = '/login' }, 2000)
  }

  if (done) {
    return (
      <main className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="PickMeUp Kids" width={140} height={56} className="object-contain" />
          </div>
          <p className="text-3xl mb-3">✅</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Password updated!</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Redirecting you to sign in…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md w-full max-w-sm p-8">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="PickMeUp Kids" width={140} height={56} className="object-contain" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Set a new password</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="New password (at least 8 characters)"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            placeholder="Confirm new password"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loading ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </main>
  )
}
