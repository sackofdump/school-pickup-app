import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single()
  if (profile?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { child_first_name, child_last_name } = await req.json()
  if (!child_first_name?.trim() || !child_last_name?.trim()) {
    return NextResponse.json({ error: 'Child first and last name are required.' }, { status: 400 })
  }

  // Check for existing pending request
  const { data: existing } = await supabase
    .from('pending_student_requests')
    .select('id')
    .eq('parent_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request.' }, { status: 409 })
  }

  const { data: request, error } = await supabase
    .from('pending_student_requests')
    .insert({
      parent_id: user.id,
      child_first_name: child_first_name.trim(),
      child_last_name: child_last_name.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ request }, { status: 201 })
}

// Admin: approve or reject a request
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action, student_id } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })

  const { data: requestRow, error: fetchErr } = await supabase
    .from('pending_student_requests')
    .select('*, profiles(email, full_name)')
    .eq('id', id)
    .single()

  if (fetchErr || !requestRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  if (action === 'reject') {
    await supabase
      .from('pending_student_requests')
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // Approve: link parent to student
  if (!student_id) return NextResponse.json({ error: 'student_id required to approve' }, { status: 400 })

  // Create the link
  const { error: linkErr } = await supabase
    .from('parent_students')
    .upsert({ parent_id: requestRow.parent_id, student_id })

  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

  await supabase
    .from('pending_student_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id)

  // Send confirmation email
  const parentProfile = requestRow.profiles as any
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const emailFrom = process.env.EMAIL_FROM ?? 'School Pickup <onboarding@resend.dev>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (resend && parentProfile?.email) {
    await resend.emails.send({
      from: emailFrom,
      to: parentProfile.email,
      subject: 'Your child has been linked to your account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1e40af;margin-bottom:8px">Good news!</h2>
          <p style="color:#374151">Hi ${parentProfile.full_name || 'there'},</p>
          <p style="color:#374151">
            Your request to add <strong>${requestRow.child_first_name} ${requestRow.child_last_name}</strong>
            has been approved. You can now check in for pickup${appUrl ? ` at <a href="${appUrl}" style="color:#2563eb">${appUrl}</a>` : ''}.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you weren't expecting this email, please ignore it.</p>
        </div>
      `,
    }).catch(() => {/* non-fatal */})
  }

  return NextResponse.json({ ok: true })
}
