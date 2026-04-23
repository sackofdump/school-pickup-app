import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ParentHome from '@/components/ParentHome'

export default async function ParentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'parent') redirect(`/${profile?.role ?? 'login'}`)

  // Fetch linked children
  const { data: links } = await supabase
    .from('parent_students')
    .select('student_id, students(id, full_name, grade, class_name)')
    .eq('parent_id', user.id)

  const students = (links ?? []).map((l: any) => l.students).filter(Boolean)

  // Fetch today's queue entries for this parent
  const today = new Date().toISOString().split('T')[0]
  const { data: queueEntries } = await supabase
    .from('pickup_queue')
    .select('student_id, status')
    .eq('parent_id', user.id)
    .gte('arrived_at', `${today}T00:00:00`)

  const queueMap: Record<string, string> = {}
  for (const entry of queueEntries ?? []) {
    queueMap[entry.student_id] = entry.status
  }

  // Fetch today's absences for linked students
  const studentIds = students.map((s: any) => s.id)
  const { data: absenceEntries } = studentIds.length
    ? await supabase.from('absences').select('student_id').eq('date', today).in('student_id', studentIds)
    : { data: [] }

  const absentIds = (absenceEntries ?? []).map((a: any) => a.student_id)

  return (
    <ParentHome
      profile={profile}
      students={students}
      queueMap={queueMap}
      initialAbsentIds={absentIds}
    />
  )
}
