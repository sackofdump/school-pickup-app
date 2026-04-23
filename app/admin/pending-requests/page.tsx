import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PendingRequestsManager from '@/components/PendingRequestsManager'

export default async function PendingRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const [{ data: requests }, { data: students }] = await Promise.all([
    supabase
      .from('pending_student_requests')
      .select('id, child_first_name, child_last_name, status, created_at, profiles(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('students')
      .select('id, full_name, grade, class_name')
      .order('full_name'),
  ])

  return <PendingRequestsManager requests={(requests ?? []) as any} students={students ?? []} />
}
