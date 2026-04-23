import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getDistanceMeters } from '@/lib/location'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { student_id, lat, lng } = await req.json()

  if (!student_id || lat == null || lng == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('parent_students')
    .select('student_id')
    .eq('parent_id', user.id)
    .eq('student_id', student_id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'Student not linked to your account' }, { status: 403 })
  }

  // Get the student's school
  const { data: student } = await supabase
    .from('students')
    .select('school_id')
    .eq('id', student_id)
    .single()

  const schoolId = (student as any)?.school_id ?? null

  // Check against all locations for this school (or all locations if no school)
  let locationsQuery = supabase.from('school_locations').select('lat, lng, radius_meters, name')
  if (schoolId) locationsQuery = locationsQuery.eq('school_id', schoolId)

  const { data: locations } = await locationsQuery

  let locationVerified = false
  if (locations && locations.length > 0) {
    for (const loc of locations) {
      const distance = getDistanceMeters(lat, lng, loc.lat, loc.lng)
      if (distance <= loc.radius_meters) {
        locationVerified = true
        break
      }
    }
    if (!locationVerified) {
      const closestDist = Math.min(
        ...locations.map(loc => getDistanceMeters(lat, lng, loc.lat, loc.lng))
      )
      return NextResponse.json({
        error: `You don't appear to be at school yet. You are ${Math.round(closestDist)}m from the nearest pickup location.`,
      }, { status: 422 })
    }
  } else {
    // Fallback to legacy school_settings
    const { data: settings } = await supabase.from('school_settings').select('lat, lng, radius_meters').single()
    if (settings) {
      const distance = getDistanceMeters(lat, lng, settings.lat, settings.lng)
      locationVerified = distance <= settings.radius_meters
      if (!locationVerified) {
        return NextResponse.json({
          error: `You don't appear to be at school yet. You are ${Math.round(distance)}m away (limit: ${settings.radius_meters}m).`,
        }, { status: 422 })
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('pickup_queue')
    .select('id, status')
    .eq('parent_id', user.id)
    .eq('student_id', student_id)
    .gte('arrived_at', `${today}T00:00:00`)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      error: existing.status === 'waiting'
        ? 'You are already in the queue.'
        : 'This child has already been picked up today.',
    }, { status: 409 })
  }

  const { data: entry, error } = await supabase
    .from('pickup_queue')
    .insert({
      student_id,
      parent_id: user.id,
      location_verified: locationVerified,
      status: 'waiting',
      school_id: schoolId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, pickup_mode } = await req.json()
  if (!student_id || !pickup_mode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['driving', 'walking'].includes(pickup_mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('pickup_queue')
    .update({ pickup_mode })
    .eq('parent_id', user.id)
    .eq('student_id', student_id)
    .gte('arrived_at', `${today}T00:00:00`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
