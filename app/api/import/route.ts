import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/password'
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
  temp_password?: string
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' },
      { status: 500 }
    )
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
      // 1. Find or create student (check by name first to avoid upsert constraint issues)
      let studentId: string
      const { data: existingStudent } = await admin
        .from('students')
        .select('id')
        .eq('full_name', student_name.trim())
        .single()

      if (existingStudent) {
        studentId = existingStudent.id
      } else {
        const { data: newStudent, error: studentError } = await admin
          .from('students')
          .insert({ full_name: student_name.trim(), grade: grade.trim(), class_name: class_name.trim() })
          .select('id')
          .single()
        if (studentError) throw new Error(`Could not create student: ${studentError.message}`)
        studentId = newStudent.id
      }

      // 2. Find or create parent
      const email = parent_email.trim().toLowerCase()
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      let parentId: string
      let isNew = false

      let tempPassword: string | undefined
      if (existingProfile) {
        parentId = existingProfile.id
      } else {
        tempPassword = generateTempPassword()
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: parent_name.trim(), role: 'parent', must_change_password: true },
        })
        if (createError) throw new Error(`Could not create parent: ${createError.message}`)
        parentId = newUser.user.id
        isNew = true

        // Ensure profile row has correct name/role (trigger may lag)
        await admin.from('profiles').upsert({
          id: parentId,
          email,
          full_name: parent_name.trim(),
          role: 'parent',
        })
      }

      // 3. Link parent → student
      await admin
        .from('parent_students')
        .upsert(
          { parent_id: parentId, student_id: studentId },
          { onConflict: 'parent_id,student_id', ignoreDuplicates: true }
        )

      results.push({
        row: i + 1,
        student_name,
        parent_email,
        status: isNew ? 'created' : 'existing',
        detail: isNew
          ? 'Account created'
          : 'Parent account already existed — linked to student.',
        temp_password: isNew ? tempPassword : undefined,
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
