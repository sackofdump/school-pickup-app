'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCurrentPosition } from '@/lib/location'
import { createClient } from '@/lib/supabase/client'
import type { Student, Profile } from '@/types'

interface Props {
  profile: Profile
  students: Student[]
  queueMap: Record<string, string>
  initialAbsentIds: string[]
}

function getSuccessMessage() {
  return new Date().getDay() === 5 ? 'Success! See you Monday!' : 'Success! See you tomorrow!'
}

export default function ParentHome({ profile, students, queueMap, initialAbsentIds }: Props) {
  const [statuses, setStatuses] = useState<Record<string, string>>(queueMap)
  const [absentIds] = useState<Set<string>>(new Set(initialAbsentIds))
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [justPickedUp, setJustPickedUp] = useState<Record<string, boolean>>({})

  const supabase = useMemo(() => createClient(), [])

  const fetchStatuses = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('pickup_queue')
      .select('student_id, status')
      .eq('parent_id', profile.id)
      .gte('arrived_at', `${today}T00:00:00`)

    if (!data) return

    setStatuses(prev => {
      const next = { ...prev }
      const newPickups: string[] = []
      for (const entry of data) {
        if (entry.status === 'picked_up' && prev[entry.student_id] !== 'picked_up') {
          newPickups.push(entry.student_id)
        }
        next[entry.student_id] = entry.status
      }
      if (newPickups.length > 0) {
        setJustPickedUp(p => {
          const updated = { ...p }
          for (const id of newPickups) updated[id] = true
          return updated
        })
      }
      return next
    })
  }, [supabase, profile.id])

  useEffect(() => {
    const channel = supabase
      .channel('parent_queue')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pickup_queue', filter: `parent_id=eq.${profile.id}` },
        (payload) => {
          const { student_id, status } = payload.new as { student_id: string; status: string }
          setStatuses(prev => ({ ...prev, [student_id]: status }))
          if (status === 'picked_up') {
            setJustPickedUp(prev => ({ ...prev, [student_id]: true }))
          }
        }
      )
      .subscribe()

    // Polling fallback every 5s so the success message always appears even if real-time drops
    const poll = setInterval(fetchStatuses, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [supabase, profile.id, fetchStatuses])

  async function handleCheckIn(student: Student) {
    setLoading(prev => ({ ...prev, [student.id]: true }))
    setErrors(prev => ({ ...prev, [student.id]: '' }))

    try {
      let lat: number, lng: number

      try {
        const pos = await getCurrentPosition()
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        setErrors(prev => ({
          ...prev,
          [student.id]: 'Location access denied. Please enable location and try again.',
        }))
        return
      }

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, lat, lng }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors(prev => ({ ...prev, [student.id]: data.error }))
      } else {
        setStatuses(prev => ({ ...prev, [student.id]: 'waiting' }))
      }
    } finally {
      setLoading(prev => ({ ...prev, [student.id]: false }))
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-white text-lg">School Pickup</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Hi, {profile.full_name}</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Sign out</button>
        </form>
      </header>

      <div className="max-w-lg mx-auto p-4 pt-6">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Your children</h2>

        {students.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500 shadow-sm">
            <p className="text-4xl mb-3">👦</p>
            <p>No children linked to your account yet.</p>
            <p className="text-sm mt-1">Contact the school admin to get set up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => {
              const status = statuses[student.id]
              const isLoading = loading[student.id]
              const error = errors[student.id]
              const isNew = justPickedUp[student.id]
              const isAbsent = absentIds.has(student.id) && !status

              return (
                <div key={student.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl font-bold text-blue-600 dark:text-blue-300">
                      {student.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{student.full_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {student.grade && `Grade ${student.grade}`}
                        {student.grade && student.class_name && ' · '}
                        {student.class_name}
                      </p>
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mb-3">
                      {error}
                    </p>
                  )}

                  {status === 'waiting' ? (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl px-4 py-3">
                      <span className="text-amber-500 text-lg">⏳</span>
                      <div>
                        <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">You're in the queue!</p>
                        <p className="text-amber-600 dark:text-amber-500 text-xs">A teacher will bring {student.full_name} out shortly.</p>
                      </div>
                    </div>
                  ) : status === 'picked_up' ? (
                    <div className={`rounded-xl px-4 py-4 text-center ${isNew ? 'bg-green-500' : 'bg-green-50 dark:bg-green-900/30'}`}>
                      <p className="text-3xl mb-1">{isNew ? '🎉' : '✅'}</p>
                      <p className={`font-bold text-sm ${isNew ? 'text-white' : 'text-green-700 dark:text-green-400'}`}>
                        {isNew ? getSuccessMessage() : `${student.full_name} has been picked up today.`}
                      </p>
                    </div>
                  ) : isAbsent ? (
                    <div className="rounded-xl border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 px-4 py-4">
                      <p className="font-semibold text-orange-800 dark:text-orange-300 text-sm mb-0.5">
                        {student.full_name} was marked absent today
                      </p>
                      <p className="text-orange-600 dark:text-orange-400 text-xs mb-3">
                        Here by mistake? You can still check in.
                      </p>
                      <button
                        onClick={() => handleCheckIn(student)}
                        disabled={isLoading}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Checking location…
                          </span>
                        ) : (
                          'Check in anyway'
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(student)}
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl py-4 text-lg transition-colors active:scale-95"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Checking location…
                        </span>
                      ) : (
                        "I'm Here! 👋"
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Your location is only used to confirm you're at school.
        </p>
      </div>
    </main>
  )
}
