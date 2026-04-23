import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ParentsPage from '@/components/ParentsPage'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const { data: parents } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, parent_students(student_id, students(full_name, grade, class_name))')
    .eq('role', 'parent')
    .order('full_name')

  return <ParentsPage initialParents={(parents ?? []) as any} />
}
