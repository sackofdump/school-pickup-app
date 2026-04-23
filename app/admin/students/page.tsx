import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSchoolId } from '@/lib/active-school'
import StudentsManager from '@/components/StudentsManager'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const schoolId = await getActiveSchoolId()
  if (!schoolId) redirect('/admin')

  const [{ data: students }, { data: parents }] = await Promise.all([
    supabase
      .from('students')
      .select('*, parent_students(parent_id, profiles(id, full_name, email))')
      .eq('school_id', schoolId)
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'parent')
      .order('full_name'),
  ])

  return <StudentsManager students={students ?? []} parents={parents ?? []} />
}
