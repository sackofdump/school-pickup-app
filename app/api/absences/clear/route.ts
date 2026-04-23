import { createClient } from '@/lib/supabase/server'
import { getActiveSchoolId } from '@/lib/active-school'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['teacher', 'admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { date } = await req.json()
  const targetDate = date ?? new Date().toISOString().split('T')[0]

  const schoolId = await getActiveSchoolId()

  if (schoolId) {
    // Get student IDs for this school, then delete their absences
    const { data: students } = await supabase.from('students').select('id').eq('school_id', schoolId)
    const studentIds = (students ?? []).map(s => s.id)
    if (studentIds.length > 0) {
      const { error } = await supabase.from('absences').delete().eq('date', targetDate).in('student_id', studentIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from('absences').delete().eq('date', targetDate)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
