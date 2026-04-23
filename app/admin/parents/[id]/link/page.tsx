import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LinkStudentPage from '@/components/LinkStudentPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: parentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const [{ data: parent }, { data: students }, { data: linked }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('id', parentId).single(),
    supabase.from('students').select('id, full_name, grade, class_name').order('full_name'),
    supabase.from('parent_students').select('student_id').eq('parent_id', parentId),
  ])

  if (!parent) redirect('/admin/parents')

  const linkedIds = new Set((linked ?? []).map((l: any) => l.student_id))

  return (
    <LinkStudentPage
      parent={parent}
      students={(students ?? []).map(s => ({ ...s, linked: linkedIds.has(s.id) }))}
    />
  )
}
