import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SchoolSettings from '@/components/SchoolSettings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  const { data: settings } = await supabase
    .from('school_settings')
    .select('*')
    .single()

  return <SchoolSettings settings={settings} />
}
