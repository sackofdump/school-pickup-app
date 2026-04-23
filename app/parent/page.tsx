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

  const { data: links } = await supabase
    .from('parent_students')
    .select('student_id, students(id, full_name, grade, class_name)')
    .eq('parent_id', user.id)

  const students = (links ?? []).map((l: any) => l.students).filter(Boolean)

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

  const studentIds = students.map((s: any) => s.id)
  const { data: absenceEntries } = studentIds.length
    ? await supabase.from('absences').select('student_id').eq('date', today).in('student_id', studentIds)
    : { data: [] }

  const absentIds = (absenceEntries ?? []).map((a: any) => a.student_id)

  // Fetch pending link request if parent has no linked children
  let pendingRequest = null
  if (students.length === 0) {
    const { data: pending } = await supabase
      .from('pending_student_requests')
      .select('id, child_first_name, child_last_name, status')
      .eq('parent_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    pendingRequest = pending
  }

  return (
    <ParentHome
      profile={profile}
      students={students}
      queueMap={queueMap}
      initialAbsentIds={absentIds}
      pendingRequest={pendingRequest}
    />
  )
}
