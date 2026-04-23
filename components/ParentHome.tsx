'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { getCurrentPosition } from '@/lib/location'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

interface School {
  id: string
  name: string
}

interface Student {
  id: string
  full_name: string
  grade: string
  class_name: string
  school_id: string | null
  schools: School | null
}

interface Props {
  profile: Profile
  students: Student[]
  queueMap: Record<string, string>
  initialAbsentIds: string[]
  pendingRequest?: { id: string; child_first_name: string; child_last_name: string; status: string } | null
}

function getSuccessMessage() {
  return new Date().getDay() === 5 ? 'Success! See you Monday!' : 'Success! See you tomorrow!'
}

function firstName(fullName: string) {
  return fullName.split(' ')[0]
}

function deriveSchools(students: Student[]): School[] {
  const seen = new Set<string>()
  const result: School[] = []
  for (const s of students) {
    if (s.school_id && s.schools && !seen.has(s.school_id)) {
      seen.add(s.school_id)
      result.push({ id: s.school_id, name: s.schools.name })
    }
  }
  return result
}

export default function ParentHome({ profile, students, queueMap, initialAbsentIds, pendingRequest: initialPendingRequest }: Props) {
  const schools = useMemo(() => deriveSchools(students), [students])
  const multiSchool = schools.length > 1

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(
    multiSchool ? null : (schools[0]?.id ?? null)
  )

  const visibleStudents = useMemo(() =>
    selectedSchoolId
      ? students.filter(s => s.school_id === selectedSchoolId)
      : students.filter(s => !s.school_id), // fallback: students with no school
    [students, selectedSchoolId]
  )

  const [statuses, setStatuses] = useState<Record<string, string>>(queueMap)
  const [absentIds] = useState<Set<string>>(new Set(initialAbsentIds))
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [justPickedUp, setJustPickedUp] = useState<Record<string, boolean>>({})

  const [pendingRequest, setPendingRequest] = useState(initialPendingRequest ?? null)
  const [requestFirstName, setRequestFirstName] = useState('')
  const [requestLastName, setRequestLastName] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState('')

  const [modePromptStudentId, setModePromptStudentId] = useState<string | null>(null)
  const [pickupModes, setPickupModes] = useState<Record<string, 'driving' | 'walking'>>({})
  const [modeLoading, setModeLoading] = useState(false)

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
        setErrors(prev => ({ ...prev, [student.id]: 'Location access denied. Please enable location and try again.' }))
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
        setModePromptStudentId(student.id)
      }
    } finally {
      setLoading(prev => ({ ...prev, [student.id]: false }))
    }
  }

  async function handleModeSelect(studentId: string, mode: 'driving' | 'walking') {
    setModeLoading(true)
    setPickupModes(prev => ({ ...prev, [studentId]: mode }))
    await fetch('/api/checkin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, pickup_mode: mode }),
    })
    setModeLoading(false)
    setModePromptStudentId(null)
  }

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRequestLoading(true)
    setRequestError('')
    try {
      const res = await fetch('/api/pending-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_first_name: requestFirstName.trim(), child_last_name: requestLastName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRequestError(data.error ?? 'Something went wrong.')
      } else {
        setPendingRequest(data.request)
      }
    } catch {
      setRequestError('Network error — check your connection.')
    } finally {
      setRequestLoading(false)
    }
  }

  // School picker screen
  if (multiSchool && selectedSchoolId === null) {
    return (
      <main className="min-h-screen bg-blue-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="PickMeUp Kids" width={100} height={40} className="object-contain" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Hi, {profile.full_name}</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Sign out</button>
          </form>
        </header>

        <div className="max-w-lg mx-auto p-4 pt-8">
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">Which school are you picking up from?</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">You have children at multiple schools.</p>

          <div className="space-y-3">
            {schools.map(school => (
              <button
                key={school.id}
                onClick={() => setSelectedSchoolId(school.id)}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 active:scale-95 transition-all text-left flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/60 flex items-center justify-center shrink-0 overflow-hidden p-1">
                  <Image src="/logo.png" alt="" width={40} height={40} className="object-contain" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{school.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {students.filter(s => s.school_id === school.id).map(s => firstName(s.full_name)).join(', ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId)

  return (
    <main className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {multiSchool && (
            <button
              onClick={() => setSelectedSchoolId(null)}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-lg leading-none"
              title="Switch school"
            >
              ←
            </button>
          )}
          <Image src="/logo.png" alt="PickMeUp Kids" width={100} height={40} className="object-contain" />
          {selectedSchool && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{selectedSchool.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400 text-sm hidden sm:block">Hi, {profile.full_name}</span>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 pt-6">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Your children</h2>

        {visibleStudents.length === 0 ? (
          pendingRequest ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm border border-amber-200 dark:border-amber-700">
              <p className="text-4xl mb-3">⏳</p>
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Request pending</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Your request to add <strong>{pendingRequest.child_first_name} {pendingRequest.child_last_name}</strong> is
                waiting for admin approval. You will receive an email once confirmed.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-4xl mb-3 text-center">👦</p>
              <p className="text-center font-semibold text-gray-800 dark:text-gray-100 mb-1">Add your child</p>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">
                Enter your child's name. The school admin will confirm the link.
              </p>
              <form onSubmit={handleRequestSubmit} className="space-y-3">
                <input
                  type="text"
                  value={requestFirstName}
                  onChange={e => setRequestFirstName(e.target.value)}
                  required
                  placeholder="Child's first name"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="text"
                  value={requestLastName}
                  onChange={e => setRequestLastName(e.target.value)}
                  required
                  placeholder="Child's last name"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {requestError && (
                  <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{requestError}</p>
                )}
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
                >
                  {requestLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {visibleStudents.map(student => {
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
                    <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mb-3">{error}</p>
                  )}

                  {status === 'waiting' ? (
                    <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-lg">⏳</span>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">You're in the queue!</p>
                          <p className="text-amber-600 dark:text-amber-500 text-xs">
                            <span className="font-medium">{firstName(student.full_name)}</span> will be out shortly.
                          </p>
                        </div>
                        {pickupModes[student.id] && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            pickupModes[student.id] === 'walking'
                              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          }`}>
                            {pickupModes[student.id] === 'walking' ? '🚶 Walking' : '🚗 Driving'}
                          </span>
                        )}
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
                        ) : 'Check in anyway'}
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
                      ) : "I'm Here! 👋"}
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

      {/* Pickup mode bottom sheet */}
      {modePromptStudentId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModePromptStudentId(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6" />
            <p className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">How are you picking up?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">This helps staff direct your child to the right spot.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleModeSelect(modePromptStudentId, 'driving')}
                disabled={modeLoading}
                className="flex flex-col items-center gap-2 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-95 border-2 border-blue-200 dark:border-blue-700 rounded-2xl py-6 transition-all disabled:opacity-50"
              >
                <span className="text-4xl">🚗</span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">Driving</span>
                <span className="text-xs text-blue-500 dark:text-blue-400">Car pickup line</span>
              </button>
              <button
                onClick={() => handleModeSelect(modePromptStudentId, 'walking')}
                disabled={modeLoading}
                className="flex flex-col items-center gap-2 bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 active:scale-95 border-2 border-purple-200 dark:border-purple-700 rounded-2xl py-6 transition-all disabled:opacity-50"
              >
                <span className="text-4xl">🚶</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">Walking</span>
                <span className="text-xs text-purple-500 dark:text-purple-400">Pickup gate / on foot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
