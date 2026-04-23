import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Called daily at 4pm CST (21:00 UTC, Mon–Fri) by a cron service.
// Set CRON_SECRET in env and pass it as the Authorization: Bearer <secret> header.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('absences').delete().eq('date', today)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ cleared: true, date: today })
}
