import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchoolId } from '@/lib/active-school'
import ParentsPage from '@/components/ParentsPage'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const schoolId = await getActiveSchoolId()
  if (!schoolId) redirect('/admin')

  // Get parents who have at least one student in this school
  const { data: schoolStudents } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', schoolId)

  const studentIds = (schoolStudents ?? []).map(s => s.id)

  let parents: any[] = []
  if (studentIds.length > 0) {
    const { data: parentLinks } = await supabase
      .from('parent_students')
      .select('parent_id')
      .in('student_id', studentIds)

    const parentIds = [...new Set((parentLinks ?? []).map((l: any) => l.parent_id))]

    if (parentIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at, parent_students(student_id, students(full_name, grade, class_name))')
        .in('id', parentIds)
        .eq('role', 'parent')
        .order('full_name')
      parents = data ?? []
    }
  }

  return <ParentsPage initialParents={parents as any} />
}
