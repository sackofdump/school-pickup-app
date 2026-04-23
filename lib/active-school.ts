import { cookies } from 'next/headers'

export async function getActiveSchoolId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('active_school_id')?.value ?? null
}
