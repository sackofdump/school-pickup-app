import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { school_id } = await req.json()
  const res = NextResponse.json({ ok: true })
  if (school_id) {
    res.cookies.set('active_school_id', school_id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
  } else {
    res.cookies.delete('active_school_id')
  }
  return res
}
