import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AbsencesManager from '@/components/AbsencesManager'

export default async function AbsenceAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id, full_name')
    .eq('id', user.id)
    .single()

  if (!['absenceAdmin', 'admin'].includes(profile?.role)) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const schoolId = (profile as any)?.school_id ?? null

  const studentsQuery = supabase.from('students').select('id, full_name, grade, class_name').order('full_name')
  if (schoolId) studentsQuery.eq('school_id', schoolId)

  const [{ data: students }, { data: absences }] = await Promise.all([
    studentsQuery,
    supabase.from('absences').select('id, student_id, date, note').eq('date', today),
  ])

  const absentIds = new Set((absences ?? []).map(a => a.student_id))

  return (
    <AbsencesManager
      students={(students ?? []).map(s => ({ ...s, absent: absentIds.has(s.id) }))}
      date={today}
      backHref={null}
    />
  )
}
