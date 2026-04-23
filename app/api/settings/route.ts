import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, lat, lng, radius_meters } = await req.json()

  if (!name || lat == null || lng == null || !radius_meters) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  // Upsert — there's only ever one row
  const { data, error } = await supabase
    .from('school_settings')
    .upsert({ id: 1, name, lat, lng, radius_meters, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
