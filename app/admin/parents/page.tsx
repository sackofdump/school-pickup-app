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

  // Get all parents registered for this school (via school_parents roster)
  const { data: rosterLinks } = await supabase
    .from('school_parents')
    .select('parent_id')
    .eq('school_id', schoolId)

  const rosterParentIds = (rosterLinks ?? []).map((r: any) => r.parent_id)

  let parents: any[] = []
  if (rosterParentIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, parent_students(student_id, students(full_name, grade, class_name))')
      .in('id', rosterParentIds)
      .eq('role', 'parent')
      .order('full_name')
    parents = data ?? []
  }

  return <ParentsPage initialParents={parents as any} />
}
