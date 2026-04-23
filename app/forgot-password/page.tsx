'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="PickMeUp Kids" width={140} height={56} className="object-contain" />
          </div>
          <p className="text-3xl mb-3">📧</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            If an account exists for <strong>{email}</strong>, a reset link has been sent.
          </p>
          <Link href="/login" className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
            ← Back to sign in
          </Link>
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
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Forgot your password?</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Enter your email and we'll send a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
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
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
