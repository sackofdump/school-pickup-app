import { createClient } from '@/lib/supabase/server'
import { getActiveSchoolId } from '@/lib/active-school'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today = new Date().toISOString().split('T')[0]
  const schoolId = await getActiveSchoolId()

  let query = supabase.from('pickup_queue').delete().gte('arrived_at', `${today}T00:00:00`)
  if (schoolId) query = query.eq('school_id', schoolId)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
