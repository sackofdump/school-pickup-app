import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AbsencesManager from '@/components/AbsencesManager'

export default async function AbsencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'teacher'].includes(profile?.role)) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: students }, { data: absences }] = await Promise.all([
    supabase.from('students').select('id, full_name, grade, class_name').order('full_name'),
    supabase.from('absences').select('id, student_id, date, note').eq('date', today),
  ])

  const absentIds = new Set((absences ?? []).map(a => a.student_id))

  return (
    <AbsencesManager
      students={(students ?? []).map(s => ({ ...s, absent: absentIds.has(s.id) }))}
      date={today}
      backHref={profile?.role === 'admin' ? '/admin' : '/teacher'}
    />
  )
}
