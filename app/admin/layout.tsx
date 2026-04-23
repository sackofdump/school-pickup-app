import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveSchoolId } from '@/lib/active-school'
import SchoolSwitcherBar from '@/components/SchoolSwitcherBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const { data: schools } = await supabase.from('schools').select('id, name').order('name')
  const activeSchoolId = await getActiveSchoolId()

  // Auto-select first school if none is active
  const resolvedActiveId = activeSchoolId ?? (schools?.[0]?.id ?? null)

  return (
    <div className="min-h-screen flex flex-col">
      <SchoolSwitcherBar
        schools={schools ?? []}
        activeSchoolId={resolvedActiveId}
      />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
