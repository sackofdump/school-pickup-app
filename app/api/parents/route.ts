import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const { full_name, email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createAdminClient()

  // Check if already exists
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email.trim().toLowerCase()).single()
  if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: '4004',
    email_confirm: true,
    user_metadata: { full_name: full_name?.trim() ?? '', role: 'parent' },
  })

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })

  await admin.from('profiles').upsert({
    id: newUser.user.id,
    email: email.trim().toLowerCase(),
    full_name: full_name?.trim() ?? '',
    role: 'parent',
  })

  return NextResponse.json({ id: newUser.user.id, email, full_name }, { status: 201 })
}
