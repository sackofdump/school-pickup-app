import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export interface ImportRow {
  student_name: string
  grade: string
  class_name: string
  parent_name: string
  parent_email: string
}

export interface ImportResult {
  row: number
  student_name: string
  parent_email: string
  status: 'created' | 'existing' | 'error'
  detail: string
}

export async function POST(req: NextRequest) {
  // Auth check — must be admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rows }: { rows: ImportRow[] } = await req.json()
  if (!rows?.length) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const results: ImportResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const { student_name, grade, class_name, parent_name, parent_email } = row

    try {
      // 1. Upsert student
      const { data: student, error: studentError } = await admin
        .from('students')
        .upsert(
          { full_name: student_name.trim(), grade: grade.trim(), class_name: class_name.trim() },
          { onConflict: 'full_name', ignoreDuplicates: false }
        )
        .select('id')
        .single()

      if (studentError) throw new Error(`Student error: ${studentError.message}`)

      // 2. Check if parent already exists
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', parent_email.trim().toLowerCase())
        .single()

      let parentId: string

      if (existingProfile) {
        parentId = existingProfile.id
      } else {
        // Create parent account via admin API — sends invite email
        const { data: newUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
          parent_email.trim().toLowerCase(),
          {
            data: {
              full_name: parent_name.trim(),
              role: 'parent',
            },
          }
        )

        if (inviteError) throw new Error(`Invite error: ${inviteError.message}`)
        parentId = newUser.user.id

        // Profile is auto-created by the DB trigger, but update name/role to be sure
        await admin
          .from('profiles')
          .upsert({
            id: parentId,
            email: parent_email.trim().toLowerCase(),
            full_name: parent_name.trim(),
            role: 'parent',
          })
      }

      // 3. Link parent to student
      await admin
        .from('parent_students')
        .upsert(
          { parent_id: parentId, student_id: student.id },
          { onConflict: 'parent_id,student_id', ignoreDuplicates: true }
        )

      results.push({
        row: i + 1,
        student_name,
        parent_email,
        status: existingProfile ? 'existing' : 'created',
        detail: existingProfile
          ? 'Parent account already existed — linked to student.'
          : 'Invite email sent to parent.',
      })
    } catch (err: any) {
      results.push({
        row: i + 1,
        student_name,
        parent_email,
        status: 'error',
        detail: err.message,
      })
    }
  }

  return NextResponse.json({ results })
}
