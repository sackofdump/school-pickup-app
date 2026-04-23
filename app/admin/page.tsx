import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  const [{ count: studentCount }, { count: parentCount }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'parent'),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm">Welcome, {profile.full_name}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-3xl font-bold text-blue-600">{studentCount ?? 0}</p>
            <p className="text-gray-600 text-sm mt-1">Students</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-3xl font-bold text-green-600">{parentCount ?? 0}</p>
            <p className="text-gray-600 text-sm mt-1">Parents</p>
          </div>
        </div>

        <div className="grid gap-4">
          <Link
            href="/admin/students"
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👦</span>
              <div>
                <p className="font-semibold text-gray-800">Manage Students</p>
                <p className="text-gray-500 text-sm">Add students and link parents</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </Link>

          <Link
            href="/admin/settings"
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <p className="font-semibold text-gray-800">School Location</p>
                <p className="text-gray-500 text-sm">Set GPS coordinates and pickup radius</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </Link>
        </div>
      </div>
    </main>
  )
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2"
      >
        Sign out
      </button>
    </form>
  )
}
