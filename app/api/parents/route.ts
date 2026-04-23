import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempPassword } from '@/lib/password'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

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

  const tempPassword = generateTempPassword()
  const cleanEmail = email.trim().toLowerCase()
  const cleanName = full_name?.trim() ?? ''

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: cleanName, role: 'parent', must_change_password: true },
  })

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })

  await admin.from('profiles').upsert({
    id: newUser.user.id,
    email: cleanEmail,
    full_name: cleanName,
    role: 'parent',
  })

  // Send welcome email with temp password
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const emailFrom = process.env.EMAIL_FROM ?? 'School Pickup <onboarding@resend.dev>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let emailSent = false

  let emailError: string | undefined

  if (!process.env.RESEND_API_KEY) {
    emailError = 'RESEND_API_KEY not set in environment'
  } else if (resend) {
    try {
      const result = await resend.emails.send({
        from: emailFrom,
        to: cleanEmail,
        subject: 'Your School Pickup account is ready',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1e40af;margin-bottom:8px">Welcome to School Pickup!</h2>
            <p style="color:#374151">Hi ${cleanName || 'there'},</p>
            <p style="color:#374151">Your account has been created. Use the details below to sign in${appUrl ? ` at <a href="${appUrl}" style="color:#2563eb">${appUrl}</a>` : ''}.</p>
            <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px">EMAIL</p>
              <p style="margin:0 0 16px;font-weight:600;color:#111827">${cleanEmail}</p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px">TEMPORARY PASSWORD</p>
              <p style="margin:0;font-weight:700;font-size:20px;letter-spacing:2px;color:#111827">${tempPassword}</p>
            </div>
            <p style="color:#374151">You will be asked to set a new password on your first login.</p>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you weren't expecting this email, please ignore it.</p>
          </div>
        `,
      })
      if (result.error) {
        emailError = result.error.message
      } else {
        emailSent = true
      }
    } catch (err: any) {
      emailError = err?.message ?? 'Unknown email error'
    }
  }

  console.log('[parents] email result:', { emailSent, emailError, to: cleanEmail, from: emailFrom })

  return NextResponse.json({ id: newUser.user.id, email: cleanEmail, full_name: cleanName, temp_password: tempPassword, email_sent: emailSent, email_error: emailError ?? null }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Parent ID required' }, { status: 400 })

  const admin = createAdminClient()

  // Delete from auth (cascades to profiles via trigger/FK)
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
