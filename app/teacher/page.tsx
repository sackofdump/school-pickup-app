import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TeacherDashboard from '@/components/TeacherDashboard'

export default async function TeacherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect('/login')
  }

  // Fetch today's waiting queue
  const today = new Date().toISOString().split('T')[0]
  const { data: queue } = await supabase
    .from('pickup_queue')
    .select(`
      id, arrived_at, status, location_verified,
      students(id, full_name, grade, class_name),
      profiles!pickup_queue_parent_id_fkey(full_name)
    `)
    .eq('status', 'waiting')
    .gte('arrived_at', `${today}T00:00:00`)
    .order('arrived_at', { ascending: true })

  return <TeacherDashboard initialQueue={(queue ?? []) as any} teacherName={profile.full_name} />
}
